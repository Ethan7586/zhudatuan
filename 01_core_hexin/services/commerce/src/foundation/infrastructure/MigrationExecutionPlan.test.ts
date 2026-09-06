import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { genericMigrationSql } from './MigrationExecutionPlan';

const file = '20260829211000_platform_owner_transfer.sql';
const migration = fileURLToPath(new URL(`../../../../../../02_platform_pingtai/database/supabase/migrations/${file}`, import.meta.url));

describe('generic migration execution plan', () => {
  it('keeps the session hash column repair compatible with the immutable owner transfer migration', async () => {
    const source = await readFile(migration, 'utf8');
    const sql = genericMigrationSql(file, source);
    expect(sql).toContain('alter table identity.challenge add column if not exists session_hash char(64);');
    expect(sql.replace('add column if not exists session_hash', 'add column session_hash')).toBe(source);
  });

  it('leaves unrelated migrations byte-for-byte unchanged', () => {
    expect(genericMigrationSql('20260907010000_enable_identity_catalog_commands.sql', 'select 1;')).toBe('select 1;');
  });

  it('fails when the immutable statement no longer has the expected shape', () => {
    expect(() => genericMigrationSql(file, 'begin; commit;')).toThrow(`MIGRATION_TRANSFORM_DRIFT:${file}`);
  });
});
