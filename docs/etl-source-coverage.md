# ETL source coverage — 02/11/2026

## Result and artifacts

Read-only run on Windows, Node 24.22.1. MySQL returned 117 Active Majors,
328 Active Skills and 11 existing Opportunities. Twelve old batch records
(including mirrored files) were also loaded for deduplication; this is not a count
of twelve distinct opportunities. Existing output files were preserved.

| Registered source            | Detail pages tested | New proposals | Acceptance rate |
| ---------------------------- | ------------------: | ------------: | --------------: |
| MISA                         |                   4 |             2 |             50% |
| SmartOSC                     |                   4 |             0 |              0% |
| HCMUS Faculty of Environment |                   1 |             0 |              0% |

New totals: **2 Việc làm / 0 Thực tập / 0 Học bổng**, leaving **58 of 60**.
Both proposals are Fresher roles in Hanoi: HRBP and Web Developer at MISA.
They are Pending / is_verified=false; all catalog proposals/links remain needs_review.
The source's HRBP description has broad duties despite accepting Freshers; leader
review should assess suitability, alongside the original JD.

Four pages duplicate existing MySQL or old-batch records. SmartOSC B2B Marketing
Fresher and L&D Intern explicitly say applications are closed, despite a future
printed date. HCMUS accepts scholarship applications until 09/11/2026, but the
faculty scope does not identify exact eligible catalog Majors and no occupational
Skill is specified. No artificial mapping was created. Scholarship academic years
remain [] when the source imposes no year constraint; this scholarship was not
exported at all because its mapping needs review.

Full records and rejected-source reasons:

- [Source trials](../data/opportunities/source-coverage-trials.json)
- [Proposals](../data/opportunities/source-coverage-proposals.json)
- [Needs review](../data/opportunities/source-coverage-needs-review.csv)
- [Per-source report](../data/opportunities/source-coverage-report.json)
- [Validation](../data/opportunities/source-coverage-validation.json)

## Sources tried but not enabled

- KMS careers listing: HTTP 403; no bypass. Independently discovered official
  SmartRecruiters detail is readable, but exact catalog/location evidence still
  needs review before enabling it.
- Hasaki: listing returns a JS shell; no unverified API guessing.
- FPT IS Tech Careers sample page refers to 2024; current opening not confirmed.
- RMIT current-student scholarship: application opens 18/12/2026, not yet open.
- HCMUS Quỹ Vượt Khó: deadline was 25/10/2026 at 17:00, already passed.

No additional Axon/Canonical/Palantir/Coupa requests or sources were added.
Public robots.txt was checked for the initial employer sites; no blocked paths,
CAPTCHA workarounds, login or application submission were used. Public access is
not a reuse license: outputs contain short factual summaries and original links,
not copied full JDs, recruiter contacts or candidate information.

## Minimal implementation and rerun

`extractOfficialSources` adds a bounded, reviewed-page adapter to the existing
collector. The source manifest contains factual summaries, original URLs and short
evidence anchors; it is not an automatic summarizer or a claim of leader approval.
Every run fetches the exact canonical URL, checks scoped deadline/JD/location
anchors and application evidence, and fails closed on changed evidence, HTTP
errors, redirects or closed status. Related-job closed labels outside the selected
scope do not invalidate the primary job. Changes outside the anchors still need
human review, so these summaries are proposals, not verified source mirrors.

The companion CLI reads Active catalog entries and all existing opportunity
statuses directly from MySQL. It stops if MySQL is unavailable or counts differ;
there is no static catalog fallback. It also deduplicates against old root and
`data/opportunities` batch files, then reuses the existing ETL filters and mapping.
Recommendations, schema, migrations, UI, importer contract and approval gate were
not changed for this task.

From repository root after backend build:

```powershell
node --env-file=backend/.env backend/dist/scripts/official-opportunities-collector.js
```

This reads configuration at runtime without printing it. Only the three
`source-coverage-*` output files are rewritten. Original batches/root mirrors are
preserved. The manifest is deliberately bounded to tested pages; adding a new URL
requires reviewing its actual content and updating its evidence and summary.

Importer validation correctly blocks these unapproved proposals with `leader
approval`. A separate read-only `planImport` check returns writes=0,
blocked=false, 2 planned creates, 9 catalog reuses and 0 category creates. It is
**not** an approved importer dry-run. No approval fields were changed to bypass
validation. No MySQL writes or --apply were performed.

Additional bounded source check: IIG Vietnam official listing shows Academic Intern with deadline 31/10/2026; that sample is expired and was not registered.

Validation: root typecheck/build passed; 26 collector/importer focused tests passed; format check and git diff --check passed. No UI or MySQL-write tests were run for this read-only source task.
