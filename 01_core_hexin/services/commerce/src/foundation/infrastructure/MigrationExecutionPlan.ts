const PLATFORM_OWNER_TRANSFER = '20260829211000_platform_owner_transfer.sql';
const SESSION_HASH_COLUMN = 'alter table identity.challenge add column session_hash char(64);';
const IDEMPOTENT_SESSION_HASH_COLUMN = 'alter table identity.challenge add column if not exists session_hash char(64);';

export function genericMigrationSql(file: string, source: string): string {
  if (file !== PLATFORM_OWNER_TRANSFER) return source;
  const occurrences = source.split(SESSION_HASH_COLUMN).length - 1;
  if (occurrences !== 1) throw new Error(`MIGRATION_TRANSFORM_DRIFT:${file}`);
  return source.replace(SESSION_HASH_COLUMN, IDEMPOTENT_SESSION_HASH_COLUMN);
}
