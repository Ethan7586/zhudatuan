import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../../../../database/migrations/20260904032600_harden_risk_decisions.sql', import.meta.url), 'utf8');
const policyStore = readFileSync(new URL('../infrastructure/persistence/PgRiskPolicyStore.ts', import.meta.url), 'utf8');
const publicPort = readFileSync(new URL('../public/RiskDecisionPort.ts', import.meta.url), 'utf8');

describe('Risk persistence contract', () => {
  it('makes policy versions and decisions append-only', () => {
    expect(migration).toContain('risk_policyversion_immutable');
    expect(migration).toContain('risk_decision_immutable');
    expect(migration).toContain("revoke update,delete on risk.policyversion,risk.decision");
    expect(policyStore).not.toMatch(/update risk\.policyversion/);
  });

  it('deduplicates signal facts and deletes them at their sensitivity retention boundary', () => {
    expect(migration).toContain('risk_signal_fact_unique');
    expect(migration).toContain('risk.purgesignals');
    expect(migration).toContain('retention_until<=clock_timestamp()');
  });

  it('publishes one generic decision port without leaking case administration', () => {
    expect(publicPort).toContain("publicPort<RiskDecisionPort>('risk', 'decision')");
    expect(publicPort).not.toMatch(/RiskCase|caseRepository|risk\.case/);
  });
});
