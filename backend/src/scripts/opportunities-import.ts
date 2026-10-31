import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import type { PrismaClient } from '../generated/prisma/client.js';
import { getPrismaClient, disconnectPrismaClient } from '../lib/prisma.js';

type Category = { type: string; name: string; status: string };
export type CatalogEntry = { type: 'Major' | 'Skill'; name: string };
type CategoryClient = Pick<PrismaClient, 'category'>;
type Link = {
  review_id: string;
  major_names: string[];
  skill_names: string[];
  status: string;
};
type Item = {
  review_id: string;
  evidence: {
    source_identity: { url_kind: 'detail' | 'listing'; basis: string };
  };
  opportunity: {
    opportunity_type: string;
    title: string;
    publisher: string;
    description: string;
    requirements: string;
    source_url: string;
    location: string | null;
    work_format: string | null;
    deadline: string;
    deadline_source_date: string | null;
    deadline_source_timezone: string | null;
    status: string;
    is_verified: boolean;
    reviewed_by: number | null;
    reviewed_at: string | null;
  };
  relations: {
    major_ids: number[];
    skill_ids: number[];
    academic_years: number[];
  };
};
export type ImportBatch = {
  format_version: number;
  items: Item[];
  initial_catalog_proposal: {
    status: string;
    categories: Category[];
    opportunity_links: Link[];
  };
};
type Client = Pick<PrismaClient, 'category' | 'opportunity'>;
const normalize = (s: string) =>
  s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
const key = (type: string, name: string) => `${type}:${normalize(name)}`;
function sourceKey(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    if (name.startsWith('utm_') || name === 'apply' || name === 'trid')
      url.searchParams.delete(name);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.toString();
}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid import batch: ${message}`);
}
export function validateCatalog(value: unknown): CatalogEntry[] {
  check(Array.isArray(value) && value.length > 0, 'nonempty catalog array');
  const names = new Set<string>();
  for (const c of value) {
    check(c && typeof c === 'object' && !Array.isArray(c), 'catalog entry');
    check(
      Object.keys(c).length === 2 && 'type' in c && 'name' in c,
      'catalog accepts type/name only',
    );
    check(
      ['Major', 'Skill'].includes(c.type) &&
        typeof c.name === 'string' &&
        c.name.trim() === c.name &&
        c.name.length > 0 &&
        c.name.length <= 100 &&
        c.name.normalize('NFC') === c.name &&
        !/[\u0000-\u001f\u007f]/.test(c.name),
      'catalog type/name',
    );
    check(!names.has(key(c.type, c.name)), 'duplicate category');
    names.add(key(c.type, c.name));
  }
  return value as CatalogEntry[];
}
export async function planCategories(
  client: CategoryClient,
  categories: readonly { type: string; name: string }[],
) {
  const existing = await client.category.findMany({
    select: { category_id: true, type: true, name: true, status: true },
  });
  const steps = categories.map((c) => {
    // Case-invalid legacy types can collide with MySQL's UNIQUE(type,name).
    // Block them instead of silently treating them as valid categories.
    const matches = existing.filter(
      (e) => key(normalize(e.type), e.name) === key(normalize(c.type), c.name),
    );
    const reason =
      matches.length > 1
        ? 'ambiguous_type_name'
        : matches[0] && matches[0].type !== c.type
          ? 'invalid_existing_type'
          : matches[0] && matches[0].status !== 'Active'
            ? 'existing_not_active'
            : null;
    return {
      type: c.type,
      name: c.name,
      action: reason ? 'blocked' : matches.length ? 'reuse' : 'create',
      reason,
      existingId: matches[0]?.category_id ?? null,
      existingName: matches[0]?.name ?? null,
      existingStatus: matches[0]?.status ?? null,
    };
  });
  return {
    categories: steps,
    blocked: steps.some((c) => c.action === 'blocked'),
  };
}
type CategoryPlan = Awaited<ReturnType<typeof planCategories>>;
async function writeCategories(client: CategoryClient, plan: CategoryPlan) {
  if (plan.blocked)
    throw new Error(
      'Import blocked: category ambiguous, invalid type or Closed. No changes committed.',
    );
  const ids = new Map<string, number>();
  for (const c of plan.categories) {
    const row =
      c.action === 'create'
        ? await client.category.create({
            data: { type: c.type, name: c.name, status: 'Active' },
          })
        : { category_id: c.existingId! };
    ids.set(key(c.type, c.name), row.category_id);
  }
  return ids;
}
export async function importCategories(
  prisma: PrismaClient,
  input: unknown,
  options: { apply?: boolean } = {},
) {
  const categories = validateCatalog(input);
  if (!options.apply)
    return {
      mode: 'dry-run',
      writes: 0,
      plan: await planCategories(prisma, categories),
    };
  return prisma.$transaction(
    async (tx) => {
      const plan = await planCategories(tx, categories);
      await writeCategories(tx, plan);
      const created = plan.categories.filter(
        (c) => c.action === 'create',
      ).length;
      return {
        mode: 'apply',
        created,
        reused: plan.categories.length - created,
        plan,
      };
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  );
}
export function validateBatch(value: unknown, now = new Date()): ImportBatch {
  const b = value as ImportBatch;
  check(b?.format_version === 2 && Array.isArray(b.items), 'format/items');
  const p = b.initial_catalog_proposal;
  check(
    p?.status === 'leader_approved' &&
      Array.isArray(p.categories) &&
      Array.isArray(p.opportunity_links),
    'leader approval',
  );
  const names = new Set<string>();
  for (const c of p.categories) {
    check(
      ['Major', 'Skill'].includes(c.type) &&
        typeof c.name === 'string' &&
        c.name.trim() &&
        c.name.length <= 100 &&
        c.status === 'leader_approved',
      'category',
    );
    check(!names.has(key(c.type, c.name)), 'duplicate category');
    names.add(key(c.type, c.name));
  }
  const ids = new Set<string>(),
    sources = new Map<string, 'detail' | 'listing'>(),
    titles = new Set<string>();
  for (const x of b.items) {
    check(
      typeof x.review_id === 'string' && !ids.has(x.review_id),
      'review key',
    );
    ids.add(x.review_id);
    const o = x.opportunity;
    check(
      o && ['Thực tập', 'Việc làm', 'Học bổng'].includes(o.opportunity_type),
      'type',
    );
    for (const field of [
      'title',
      'publisher',
      'description',
      'requirements',
      'source_url',
    ] as const)
      check(typeof o[field] === 'string' && o[field].trim(), field);
    check(
      o.title.length <= 255 &&
        o.publisher.length <= 255 &&
        o.source_url.length <= 500,
      'field length',
    );
    check(
      o.location === null ||
        (typeof o.location === 'string' && o.location.length <= 100),
      'location',
    );
    check(
      o.work_format === null ||
        ['Online', 'Offline', 'Hybrid'].includes(o.work_format),
      'format',
    );
    if (o.work_format === 'Offline' || o.work_format === 'Hybrid')
      check(o.location?.trim(), 'required location');
    check(
      o.status === 'Pending' &&
        o.is_verified === false &&
        o.reviewed_by === null &&
        o.reviewed_at === null,
      'review state',
    );
    check(
      ['https:', 'http:'].includes(new URL(o.source_url).protocol),
      'source protocol',
    );
    const identity = x.evidence?.source_identity;
    check(
      identity &&
        ['detail', 'listing'].includes(identity.url_kind) &&
        typeof identity.basis === 'string' &&
        identity.basis.trim(),
      'explicit source identity',
    );
    const sk = sourceKey(o.source_url),
      tk = key(normalize(o.publisher), o.title);
    check(!titles.has(tk), 'duplicate input opportunity');
    const previousKind = sources.get(sk);
    check(
      !previousKind || previousKind === identity.url_kind,
      'inconsistent source identity',
    );
    check(
      !previousKind || identity.url_kind === 'listing',
      'duplicate input opportunity',
    );
    sources.set(sk, identity.url_kind);
    titles.add(tk);
    const instant = Date.parse(o.deadline);
    check(
      Number.isFinite(instant) && instant > now.getTime(),
      'expired/unresolved deadline',
    );
    if (o.deadline_source_date !== null) {
      check(
        /^\d{4}-\d{2}-\d{2}$/.test(o.deadline_source_date) &&
          o.deadline_source_timezone === null,
        'date metadata',
      );
      check(
        new Date(o.deadline_source_date + 'T00:00:00Z')
          .toISOString()
          .slice(0, 10) === o.deadline_source_date,
        'calendar date',
      );
      check(
        instant ===
          Date.parse(o.deadline_source_date + 'T00:00:00+07:00') + 86400000,
        'date cutoff',
      );
    } else {
      check(
        typeof o.deadline_source_timezone === 'string' &&
          /^[+-]\d{2}:\d{2}$/.test(o.deadline_source_timezone),
        'explicit offset required',
      );
    }
    check(
      x.relations?.major_ids?.length === 0 &&
        x.relations?.skill_ids?.length === 0 &&
        Array.isArray(x.relations?.academic_years),
      'no hardcoded category IDs',
    );
    check(
      x.relations.academic_years.every(
        (y) => Number.isInteger(y) && y >= 1 && y <= 4,
      ) &&
        new Set(x.relations.academic_years).size ===
          x.relations.academic_years.length,
      'years',
    );
    const links = p.opportunity_links.filter(
      (l) => l.review_id === x.review_id,
    );
    check(
      links.length === 1 && links[0].status === 'leader_approved',
      'approved links',
    );
    for (const [type, values] of [
      ['Major', links[0].major_names],
      ['Skill', links[0].skill_names],
    ] as const) {
      check(
        Array.isArray(values) &&
          new Set(values).size === values.length &&
          values.every((name) => names.has(key(type, name))),
        'linked category',
      );
    }
  }
  check(p.opportunity_links.length === b.items.length, 'extra link records');
  return b;
}

export async function planImport(client: Client, batch: ImportBatch) {
  // Full read includes processed records: status must never limit deduplication.
  const categoryPlan = await planCategories(
    client,
    batch.initial_catalog_proposal.categories,
  );
  const existingItems = await client.opportunity.findMany({
    select: {
      item_id: true,
      title: true,
      publisher: true,
      source_url: true,
      status: true,
    },
  });
  const categories = categoryPlan.categories;
  const opportunities = batch.items.map((x) => {
    const o = x.opportunity;
    const matches = existingItems.filter((e) => {
      let sameSource = false;
      try {
        sameSource =
          x.evidence.source_identity.url_kind === 'detail' &&
          !!e.source_url &&
          sourceKey(e.source_url) === sourceKey(o.source_url);
      } catch {
        /* malformed legacy URL: title fallback */
      }
      return (
        sameSource ||
        (!!e.publisher &&
          key(normalize(e.publisher), e.title) ===
            key(normalize(o.publisher), o.title))
      );
    });
    const links = batch.initial_catalog_proposal.opportunity_links.find(
      (l) => l.review_id === x.review_id,
    )!;
    return {
      reviewId: x.review_id,
      sourceUrlKind: x.evidence.source_identity.url_kind,
      action: matches.length ? 'skip_existing' : 'create',
      existing: matches.map((e) => ({ id: e.item_id, status: e.status })),
      majors: links.major_names,
      skills: links.skill_names,
      years: x.relations.academic_years,
    };
  });
  return {
    categories,
    opportunities,
    blocked: categories.some((c) => c.action === 'blocked'),
  };
}

export async function importOpportunities(
  prisma: PrismaClient,
  input: unknown,
  options: { apply?: boolean; now?: Date } = {},
) {
  const batch = validateBatch(input, options.now);
  if (!options.apply)
    return {
      mode: 'dry-run',
      writes: 0,
      plan: await planImport(prisma, batch),
    };
  // Serializable scans protect against concurrent importer phantoms despite the
  // absence of a UNIQUE source_url. Conflicts/deadlocks abort the entire batch.
  return prisma.$transaction(
    async (tx) => {
      const plan = await planImport(tx, batch);
      if (plan.blocked)
        throw new Error(
          'Import blocked: category ambiguous or Closed. No changes committed.',
        );
      const categoryIds = await writeCategories(tx, plan);
      let created = 0;
      for (const step of plan.opportunities) {
        if (step.action !== 'create') continue; // Do not alter existing content OR relations.
        const o = batch.items.find(
          (x) => x.review_id === step.reviewId,
        )!.opportunity;
        await tx.opportunity.create({
          data: {
            opportunity_type: o.opportunity_type,
            title: o.title,
            publisher: o.publisher,
            description: o.description,
            requirements: o.requirements,
            source_url: o.source_url,
            location: o.location,
            work_format: o.work_format,
            deadline: new Date(o.deadline),
            deadline_source_date: o.deadline_source_date
              ? new Date(o.deadline_source_date + 'T00:00:00Z')
              : null,
            deadline_source_timezone: o.deadline_source_timezone,
            status: 'Pending',
            is_verified: false,
            majors: {
              create: step.majors.map((name) => ({
                major_id: categoryIds.get(key('Major', name))!,
              })),
            },
            skills: {
              create: step.skills.map((name) => ({
                skill_id: categoryIds.get(key('Skill', name))!,
              })),
            },
            years: {
              create: step.years.map((academic_year) => ({ academic_year })),
            },
          },
        });
        created += 1;
      }
      return {
        mode: 'apply',
        created,
        skipped: plan.opportunities.length - created,
        plan,
      };
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  );
}

export function parseImportArgs(args: string[]) {
  let apply = false,
    dryRun = false,
    catalogOnly = false,
    file: string | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    check(!seen.has(arg), 'duplicate argument');
    seen.add(arg);
    if (arg === '--apply') apply = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (arg === '--catalog-only') catalogOnly = true;
    else if (arg === '--file') {
      file = args[++i];
      check(file && !file.startsWith('--'), '--file requires path');
    } else
      check(
        false,
        'unknown argument; use --catalog-only [--file path] [--dry-run | --apply]',
      );
  }
  check(!(apply && dryRun), 'choose --dry-run or --apply');
  return { apply, catalogOnly, file };
}
async function main() {
  const args = parseImportArgs(process.argv.slice(2));
  const input = JSON.parse(
    await readFile(
      args.file
        ? resolve(args.file)
        : new URL(
            args.catalogOnly
              ? '../../../data/catalog/initial-categories.json'
              : '../../../data/opportunities/batch-01.json',
            import.meta.url,
          ),
      'utf8',
    ),
  );
  try {
    const result = await (
      args.catalogOnly ? importCategories : importOpportunities
    )(getPrismaClient(), input, { apply: args.apply });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (result.plan.blocked) process.exitCode = 2;
  } finally {
    await disconnectPrismaClient();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    process.stderr.write(
      error instanceof Error &&
        (error.message.startsWith('Invalid import batch:') ||
          error.message.startsWith('Import blocked:'))
        ? error.message + '\n'
        : 'Import failed: input unreadable, database unavailable or write conflict; transaction rolled back if started. No credentials printed.\n',
    );
    process.exitCode = 1;
  });
}
