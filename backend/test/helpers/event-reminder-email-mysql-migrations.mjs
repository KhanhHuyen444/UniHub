import { createHash } from 'node:crypto';
import { join } from 'node:path';
// Pinned Phase 4.2 source baseline; changes require an independent SQL review.
export const REVIEWED_MIGRATIONS = Object.freeze({
  '20261025000000_initial_schema':
    'b63bbb51b5837ca28a1dd1d5e9a7b7e8365f1f22f35bbc81f76dc3aff56888a4',
  '20261026150000_add_opportunity_deadline_metadata':
    '9e256f9c0ad9c7836b883433f142738509454e81f492cbbc5c34b375b526f14b',
  '20261028170000_add_auth_identity_sessions':
    'dc33efc6777f45d07cbd1b492b13f3841908aac67f571e50886824f907acefd3',
  '20261031000000_add_event_reminder_emails':
    'bbba8c18e5e47f9b248bb1d05873486e4f8d469d251b421b5c9a0cfa479d4bd2',
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function readReviewedMigrations(fs, source) {
  const entries = await fs.readdir(source, { withFileTypes: true });
  const names = entries
    .filter((e) => e.name !== 'migration_lock.toml')
    .map((e) => e.name)
    .sort();
  if (
    JSON.stringify(names) !==
    JSON.stringify(Object.keys(REVIEWED_MIGRATIONS).sort())
  )
    throw new Error('MIGRATION_SET_REFUSED');
  const files = {};
  for (const name of names) {
    if (!entries.find((e) => e.name === name).isDirectory())
      throw new Error('MIGRATION_DIRECTORY_REFUSED');
    const directory = join(source, name);
    const contents = await fs.readdir(directory, { withFileTypes: true });
    if (
      contents.length !== 1 ||
      contents[0].name !== 'migration.sql' ||
      !contents[0].isFile()
    )
      throw new Error('MIGRATION_CONTENTS_REFUSED');
    const bytes = await fs.readFile(join(directory, 'migration.sql'));
    if (hash(bytes) !== REVIEWED_MIGRATIONS[name])
      throw new Error('MIGRATION_CHECKSUM_REFUSED');
    files[name] = bytes;
  }
  const lock = await fs.readFile(join(source, 'migration_lock.toml'), 'utf8');
  if (!/^provider = "mysql"$/m.test(lock.trim()))
    throw new Error('MIGRATION_PROVIDER_REFUSED');
  return files;
}
export async function createMigrationSnapshot(fs, source, destination, schema) {
  // Capture validated bytes, then write exclusively. No subsequent source reads by Prisma.
  const files = await readReviewedMigrations(fs, source);
  await fs.mkdir(destination);
  for (const [name, bytes] of Object.entries(files)) {
    await fs.mkdir(join(destination, name));
    await fs.writeFile(join(destination, name, 'migration.sql'), bytes, {
      flag: 'wx',
      mode: 0o400,
    });
    await fs.chmod(join(destination, name, 'migration.sql'), 0o400);
    await fs.chmod(join(destination, name), 0o500);
  }
  await fs.writeFile(
    join(destination, 'migration_lock.toml'),
    'provider = "mysql"\n',
    { flag: 'wx', mode: 0o400 },
  );
  await fs.writeFile(join(destination, '..', 'schema.prisma'), schema, {
    flag: 'wx',
    mode: 0o400,
  });
  await fs.chmod(join(destination, 'migration_lock.toml'), 0o400);
  await fs.chmod(join(destination, '..', 'schema.prisma'), 0o400);
  await fs.chmod(destination, 0o500);
}
export async function validateMigrationSnapshot(fs, source, snapshot) {
  await readReviewedMigrations(fs, source);
  await readReviewedMigrations(fs, snapshot);
}
