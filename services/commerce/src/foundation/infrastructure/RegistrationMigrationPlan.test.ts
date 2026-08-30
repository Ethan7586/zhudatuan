import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { registrationMigrationExecution } from './RegistrationMigrationPlan';

const migration = (file: string) => fileURLToPath(new URL(`../../../../../database/supabase/migrations/${file}`, import.meta.url));

describe('registration migration execution plan', () => {
  it.each([
    '20260817191000_bootstrap_ethan_platform_owner.sql',
    '20260820132000_platform_owner_reconciliation.sql',
  ])('records an explicit source and empty-execution hash for omitted environment migration %s', async (file) => {
    const execution = registrationMigrationExecution(file, await readFile(migration(file), 'utf8'));
    expect(execution.kind).toBe('omitted');
    expect(execution.sql).toBeNull();
    expect(execution.ledgerName).toBe(`registration-omitted:${file}`);
    expect(execution.ledgerStatements).toEqual([
      'profile=registration-only/v1',
      expect.stringMatching(/^source_sha256=[a-f0-9]{64}$/),
      'executed_sha256=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      expect.stringMatching(/^reason=environment-specific Ethan platform owner/),
    ]);
  });

  it.each([
    '20260821066000_resolve_invitation_scope.sql',
    '20260821069000_add_store_management.sql',
    '20260821074000_grant_platform_owner_operations.sql',
    '20260821075000_grant_platform_cardlibrary_read.sql',
    '20260821076000_grant_platform_cockpit_reads.sql',
    '20260821078000_complete_experience_application.sql',
  ])('records source and executed hashes for transformed assertion migration %s', async (file) => {
    const source = await readFile(migration(file), 'utf8');
    const execution = registrationMigrationExecution(file, source);
    expect(execution.kind).toBe('transformed');
    expect(execution.sql).not.toBe(source);
    expect(execution.ledgerName).toBe(`registration-transformed:${file}`);
    expect(execution.ledgerStatements).toEqual([
      'profile=registration-only/v1',
      expect.stringMatching(/^source_sha256=[a-f0-9]{64}$/),
      expect.stringMatching(/^executed_sha256=[a-f0-9]{64}$/),
      expect.stringMatching(/^reason=/),
    ]);
    expect(execution.ledgerStatements[1]).not.toBe(execution.ledgerStatements[2]);
  });

  it('fails closed when a known source assertion drifts', () => {
    expect(() => registrationMigrationExecution('20260821066000_resolve_invitation_scope.sql', 'begin; commit;'))
      .toThrow('REGISTRATION_MIGRATION_TRANSFORM_DRIFT:20260821066000_resolve_invitation_scope.sql');
  });

  it('records matching source and executed hashes for post-history migrations executed byte-for-byte', () => {
    const source = 'begin; select 1; commit;';
    const execution = registrationMigrationExecution('20260828170000_zhudatuan_registration_baseline.sql', source);
    expect(execution).toEqual({
      kind: 'original',
      ledgerName: '20260828170000_zhudatuan_registration_baseline.sql',
      ledgerStatements: [
        'profile=registration-only/v1',
        expect.stringMatching(/^source_sha256=[a-f0-9]{64}$/),
        expect.stringMatching(/^executed_sha256=[a-f0-9]{64}$/),
        'reason=append-only post-history migration executed byte-for-byte',
      ],
      sql: source,
    });
    expect(execution.ledgerStatements[1]?.replace('source_', '')).toBe(execution.ledgerStatements[2]?.replace('executed_', ''));
  });

  it('keeps immutable historical originals in their legacy empty-statement ledger shape', () => {
    const source = 'begin; select 1; commit;';
    expect(registrationMigrationExecution('20260820133000_inventory_single_source_cutover.sql', source)).toEqual({
      kind: 'original', ledgerName: '20260820133000_inventory_single_source_cutover.sql', ledgerStatements: [], sql: source,
    });
  });
});
