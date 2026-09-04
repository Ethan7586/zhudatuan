import { describe, expect, it } from 'vitest';
import * as riskPublic from '..';
import { RISK_CAPABILITIES, riskManifest } from '..';

describe('risk module manifest', () => {
  it('keeps the stable risk identity and lightweight public entry', () => {
    expect(riskManifest.id).toBe('risk');
    expect(riskManifest.publicEntry).toBe('./index.ts');
    expect(riskManifest.provides).toEqual([RISK_CAPABILITIES.read, RISK_CAPABILITIES.manage]);
    expect(riskPublic).toHaveProperty('RiskCheckAdapter');
    expect(riskPublic).toHaveProperty('RiskEngine');
    expect(riskPublic).not.toHaveProperty('RiskModule');
    expect(riskPublic).not.toHaveProperty('riskRoutes');
    expect(riskPublic).not.toHaveProperty('PgRiskRepository');
    expect(riskPublic).not.toHaveProperty('RiskReplayJobProcessor');
    expect(riskPublic).not.toHaveProperty('EvaluateRisk');
  });

  it('declares risk dependencies, layers, and entrypoints', () => {
    expect(riskManifest.requires).toEqual(['catalog.manage']);
    expect(riskManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(riskManifest.entrypoints.http).toEqual(['riskRoutes']);
    expect(riskManifest.entrypoints.jobs).toEqual(['riskscan']);
  });

  it('declares the complete risk operation inventory', () => {
    expect(riskManifest.operations).toEqual([
      'risk.center.read',
      'risk.policies.manage',
      'risk.cases.review',
    ]);
  });

  it('declares risk event ownership without consumers', () => {
    expect(riskManifest.publishes).toEqual([
      'risk.policy.activated',
      'risk.case.opened',
      'risk.case.resolved',
      'risk.transaction.blocked',
    ]);
    expect(riskManifest.consumes).toEqual([]);
  });
});
