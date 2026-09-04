import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SANDBOX_WELFARE_CONFIRMATION,
  SANDBOX_WELFARE_SCHEMA_CHECKSUM,
  SANDBOX_WELFARE_SCHEMA_VERSION,
  sandboxWelfareBootstrapEnvironment,
  sandboxWelfareBootstrapSummary,
} from './SandboxWelfareBootstrapPlan';

const databasePassword = 'test-only-sandbox-welfare-database-password';
const base = Object.freeze({
  APP_ENV: 'test',
  ZHUDATUAN_SANDBOX_WELFARE_CONFIRM: SANDBOX_WELFARE_CONFIRMATION,
  ZHUDATUAN_SANDBOX_WELFARE_DATABASE_URL:
    `postgresql://zhudatuansandboxbootstrap:${databasePassword}@127.0.0.1:55432/zhudatuan_registration`,
  ZHUDATUAN_SANDBOX_WELFARE_DATABASE_NAME: 'zhudatuan_registration',
  ZHUDATUAN_SANDBOX_WELFARE_SENTINEL: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ',
  ZHUDATUAN_SANDBOX_WELFARE_MEMBERSHIP: 'membership:sandbox:one',
  ZHUDATUAN_SANDBOX_WELFARE_AMOUNT_MINOR: '100',
  ZHUDATUAN_SANDBOX_WELFARE_CURRENCY: 'CNY',
});

describe('sandbox welfare bootstrap plan', () => {
  it('requires Owner confirmation, one explicit member, amount and CNY on the independent test endpoint', () => {
    assert.deepEqual(sandboxWelfareBootstrapEnvironment(base), {
      amountMinor: 100, confirmation: SANDBOX_WELFARE_CONFIRMATION,
      connectionString: base.ZHUDATUAN_SANDBOX_WELFARE_DATABASE_URL, currency: 'CNY',
      expectedDatabase: 'zhudatuan_registration', membership: 'membership:sandbox:one',
      sentinel: base.ZHUDATUAN_SANDBOX_WELFARE_SENTINEL,
    });
    for (const source of [
      { ...base, APP_ENV: 'production' },
      { ...base, ZHUDATUAN_SANDBOX_WELFARE_CONFIRM: 'yes' },
      { ...base, ZHUDATUAN_SANDBOX_WELFARE_AMOUNT_MINOR: '' },
      { ...base, ZHUDATUAN_SANDBOX_WELFARE_AMOUNT_MINOR: '0' },
      { ...base, ZHUDATUAN_SANDBOX_WELFARE_AMOUNT_MINOR: '1000001' },
      { ...base, ZHUDATUAN_SANDBOX_WELFARE_CURRENCY: 'USD' },
      { ...base, ZHUDATUAN_SANDBOX_WELFARE_MEMBERSHIP: '' },
    ]) assert.throws(() => sandboxWelfareBootstrapEnvironment(source));
  });

  it('pins 180000 and reports only the explicit non-secret grant', () => {
    assert.equal(SANDBOX_WELFARE_SCHEMA_VERSION, '20260828180000');
    assert.match(SANDBOX_WELFARE_SCHEMA_CHECKSUM, /^[a-f0-9]{64}$/);
    assert.equal(sandboxWelfareBootstrapSummary('membership:one', 100),
      'ZHUDATUAN_SANDBOX_WELFARE_READY membership=membership:one amountMinor=100 currency=CNY sandbox=true');
  });
});
