import { describe, expect, it } from 'vitest';
import { phaseOfMigration } from './MigrationRunner';

describe('migration release phases', () => {
  const historyHead = '20260903116000';

  it('keeps the frozen migration history in its original prepare baseline', () => {
    expect(phaseOfMigration('20260821026000_backfill_domain_data.sql', historyHead)).toBe('prepare');
  });

  it.each([
    ['20260904050000_prepare_voucher_model.sql', 'prepare'],
    ['20260904051000_backfill_voucher_model.sql', 'backfill'],
    ['20260904052000_assert_voucher_model.sql', 'assert'],
    ['20260904061000_publish_ideal_contract.sql', 'cutover'],
    ['20260904063000_retire_legacy_contract.sql', 'retire'],
    ['20260904065000_finalize_constraints.sql', 'retire'],
  ] as const)('classifies %s as %s', (file, phase) => {
    expect(phaseOfMigration(file, historyHead)).toBe(phase);
  });

  it('rejects paths outside the immutable migration naming contract', () => {
    expect(() => phaseOfMigration('../retire.sql', historyHead)).toThrow('MIGRATION_FILE_INVALID');
  });
});
