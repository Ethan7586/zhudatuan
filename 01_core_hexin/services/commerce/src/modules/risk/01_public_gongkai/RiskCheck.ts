import type { Signal } from '../02_domain_yewu/model/Signal';
import type { Decision } from '../02_domain_yewu/model/Decision';
import type { RiskOutcome } from '../02_domain_yewu/model/RiskPolicy';

export interface RiskCheckInput {
  readonly actor: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly scope: string;
  readonly scopes: readonly string[];
  readonly trace: string;
  readonly amountMinor: number | null;
  readonly signals: readonly Signal[];
}

export interface RiskCheck {
  check(input: RiskCheckInput): Promise<RiskAssessment>;
}

export interface RiskAssessment { readonly outcome: RiskOutcome; readonly safeReason: Decision['safeReason']; readonly decision: string | null }

export interface RiskPolicyRecord {
  readonly id: string; readonly scope: string; readonly activeVersion: number; readonly activeRule: unknown; readonly activeRollout: number;
  readonly baselineVersion: number | null; readonly baselineRule: unknown | null;
}

export interface RiskRepository {
  policies(scopes: readonly string[]): Promise<readonly RiskPolicyRecord[]>;
  signals(actor: string, scopes: readonly string[]): Promise<readonly Signal[]>;
  velocities(actor: string, operation: string, scopes: readonly string[], seconds: readonly number[]): Promise<ReadonlyMap<number, number>>;
  blocked(actor: string, scopes: readonly string[]): Promise<boolean>;
  decision(input: Readonly<{ check: RiskCheckInput; policy: string; version: number; outcome: RiskOutcome; score: number; safeReason: string;
    evidence: Readonly<Record<string, unknown>> }>): Promise<string>;
  center(scope: string, cursor: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  savePolicy(input: Readonly<{ id: string; scope: string; name: string; rule: RiskPolicyRecord['activeRule']; ruleHash: string;
    rolloutPercent: number; actor: string }>): Promise<Readonly<Record<string, unknown>>>;
  activatePolicy(input: Readonly<{ id: string; scope: string; version: number; rolloutPercent: number; actor: string; trace: string }>): Promise<Readonly<Record<string, unknown>>>;
  retirePolicy(id: string, scope: string): Promise<Readonly<Record<string, unknown>>>;
  riskCase(id: string, scope: string): Promise<Readonly<{ id: string; state: 'open' | 'reviewing' | 'cleared' | 'confirmed' | 'closed';
    actor: string | null }> | null>;
  reviewCase(input: Readonly<{ id: string; scope: string; state: string; reviewer: string; reason: string;
    evidence: Readonly<Record<string, unknown>>; trace: string }>): Promise<Readonly<Record<string, unknown>>>;
  replay(policy: string, version: number): Promise<Readonly<{ scope: string; rule: unknown }> | null>;
  replaySample(scope: string): Promise<readonly Readonly<{ actor: string; operation: string; outcome: RiskOutcome;
    evidence: Record<string, unknown>; falsePositive: boolean }>[]>;
  completeReplay(policy: string, version: number, preview: Readonly<Record<string, unknown>>): Promise<void>;
  catalogDecision(decision: string): Promise<Readonly<{ decision: string; scope: string; resource: string }> | null>;
}
