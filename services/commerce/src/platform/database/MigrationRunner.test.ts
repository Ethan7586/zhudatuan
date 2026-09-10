import { describe, expect, it } from 'vitest';
import { assertAppliedMigrationIdentities, migrationsForPhase, ownerInheritanceSql, phaseOfMigration } from './MigrationRunner';

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

  it('stops at the first migration above the approved phase gate', () => {
    const files = [
      '20260904028900_prepare_voucher_tenders.sql',
      '20260904029000_publish_voucher_redemption.sql',
      '20260904029100_prepare_voucher_refunds.sql',
    ];
    expect(migrationsForPhase(files, historyHead, 'prepare', new Set())).toEqual([files[0]]);
    expect(migrationsForPhase(files, historyHead, 'prepare', new Set([files[0]!.slice(0, 14)]))).toEqual([]);
  });

  it('continues the linear chain through lower gates after cutover approval', () => {
    const files = [
      '20260904028900_prepare_voucher_tenders.sql',
      '20260904029000_publish_voucher_redemption.sql',
      '20260904029100_prepare_voucher_refunds.sql',
    ];
    expect(migrationsForPhase(files, historyHead, 'cutover', new Set([files[0]!.slice(0, 14)]))).toEqual(files.slice(1));
  });

  it('rejects an applied migration after the first history gap', () => {
    const files = ['20260904028900_prepare_voucher_tenders.sql', '20260904029000_publish_voucher_redemption.sql'];
    expect(() => migrationsForPhase(files, historyHead, 'cutover', new Set([files[1]!.slice(0, 14)]))).toThrow(
      `MIGRATION_SEQUENCE_GAP:${files[0]}`
    );
  });

  it('rejects a reused migration version with a different file identity', () => {
    expect(() =>
      assertAppliedMigrationIdentities(['20260821070000_repair_decision_audit_scope.sql'], [
        { version: '20260821070000', name: '20260821070000_route_invoice_scopes.sql' },
      ])
    ).toThrow('MIGRATION_APPLIED_IDENTITY_DRIFT:20260821070000');
  });

  it('permits legacy versions that are outside the frozen repository history', () => {
    expect(() =>
      assertAppliedMigrationIdentities(['20260821070000_repair_decision_audit_scope.sql'], [
        { version: '20260823010000', name: '20260823010000_legacy_release.sql' },
      ])
    ).not.toThrow();
  });

  it('elevates and revokes module-owner inheritance with fixed role targets', () => {
    expect(ownerInheritanceSql(true)).toContain('with inherit true, set true');
    expect(ownerInheritanceSql(false)).toContain('with inherit false, set true');
    expect(ownerInheritanceSql(true)).toContain("member_role.rolname='shopmigration'");
    expect(ownerInheritanceSql(true)).toContain("owner_role.rolname~'^shop[a-z]+owner$'");
  });
});
