import type { OperationRisk } from '@shop/contract';
import type { Decision, RiskDecisionDraft } from '../../domain/model/Decision';
import type { Signal } from '../../domain/model/Signal';
import type { RiskOutcome } from '../../domain/model/RiskPolicy';

export interface RiskCheckInput {
  readonly actor: string;
  readonly operation: string;
  readonly resource: string | null;
  readonly scope: string;
  readonly scopes: readonly string[];
  readonly trace: string;
  readonly amountMinor: number | null;
  readonly signals: readonly Signal[];
  readonly risk: OperationRisk;
  readonly mode: 'sync' | 'async';
  readonly deadline: number;
  readonly signal: AbortSignal;
}

export interface RiskCheck {
  check(input: RiskCheckInput): Promise<RiskAssessment>;
}

export interface RiskAssessment {
  readonly outcome: RiskOutcome;
  readonly safeReason: Decision['safeReason'];
  readonly decision: string | null;
}

export interface RiskPolicyRecord {
  readonly id: string;
  readonly scope: string;
  readonly activeVersion: number;
  readonly activeRule: unknown;
  readonly activeRollout: number;
  readonly baselineVersion: number | null;
  readonly baselineRule: unknown | null;
}

export interface RiskRepository {
  policies(scopes: readonly string[]): Promise<readonly RiskPolicyRecord[]>;
  signals(actor: string, scopes: readonly string[]): Promise<readonly Signal[]>;
  velocities(actor: string, operation: string, scopes: readonly string[], seconds: readonly number[]): Promise<ReadonlyMap<number, number>>;
  blocked(actor: string, scopes: readonly string[]): Promise<boolean>;
  decision(input: Readonly<{ check: RiskCheckInput; draft: RiskDecisionDraft; scopeChain: readonly string[] }>): Promise<string>;
  defer(input: RiskCheckInput): Promise<string>;
}
