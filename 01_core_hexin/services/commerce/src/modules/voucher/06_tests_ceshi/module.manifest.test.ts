import { describe, expect, it } from 'vitest';
import * as voucherPublic from '..';
import { VOUCHER_CAPABILITIES, voucherManifest } from '..';

describe('voucher module manifest', () => {
  it('keeps the stable voucher identity and lightweight public entry', () => {
    expect(voucherManifest.id).toBe('voucher');
    expect(voucherManifest.publicEntry).toBe('./index.ts');
    expect(voucherManifest.provides).toEqual([VOUCHER_CAPABILITIES.read, VOUCHER_CAPABILITIES.manage]);
    expect(voucherPublic).toHaveProperty('VoucherPort');
    expect(voucherPublic).toHaveProperty('VoucherPolicy');
    expect(voucherPublic).not.toHaveProperty('VoucherModule');
    expect(voucherPublic).not.toHaveProperty('IdentityOperatorVoucherModule');
    expect(voucherPublic).not.toHaveProperty('voucherOperations');
    expect(voucherPublic).not.toHaveProperty('voucherOperatorReadOperations');
    expect(voucherPublic).not.toHaveProperty('VoucherJobProcessor');
    expect(voucherPublic).not.toHaveProperty('VoucherImportProcessor');
    expect(voucherPublic).not.toHaveProperty('VoucherDeadletter');
    expect(voucherPublic).not.toHaveProperty('PgVoucherImport');
  });

  it('declares voucher dependencies, layers, and entrypoints', () => {
    expect(voucherManifest.requires).toEqual(['member', 'finance']);
    expect(voucherManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(voucherManifest.entrypoints.http).toEqual(['voucherOperations', 'voucherOperatorReadOperations']);
    expect(voucherManifest.entrypoints.jobs).toEqual(['voucherissue', 'voucherstatus', 'voucherexpiry', 'voucherimport']);
  });

  it('declares the complete voucher operation inventory', () => {
    expect(voucherManifest.operations).toEqual([
      'voucher.cardlibraries.read',
      'voucher.cardlibraries.allocate',
      'voucher.cardlibraries.create',
      'voucher.programs.manage',
      'voucher.programs.read',
      'voucher.reserves.request',
      'voucher.reserves.decide',
      'voucher.reserves.read',
      'voucher.batches.issue',
      'voucher.batches.read',
      'voucher.batches.retry',
      'voucher.imports.read',
      'voucher.status.batch',
      'voucher.statusbatches.read',
      'voucher.bindings.manage',
      'voucher.bindings.read',
      'voucher.redemptions.reverse',
      'voucher.redemptions.read',
      'voucher.history.read',
    ]);
  });

  it('declares voucher event ownership without consumers', () => {
    expect(voucherManifest.publishes).toEqual([
      'voucher.issued',
      'voucher.issue.failed',
      'voucher.import.failed',
      'voucher.status.failed',
      'voucher.redeemed',
    ]);
    expect(voucherManifest.consumes).toEqual([]);
  });
});
