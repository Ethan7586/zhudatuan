import type { ContractJsonValue } from '@shop/contract';
import type { RiskCase, RiskCaseAction, RiskPolicy } from './Risk';

export type RiskRule = Readonly<Record<string, ContractJsonValue>>;

interface ApprovalFields {
  readonly proof: string;
  readonly confirmed: boolean;
}

export type RiskEditor =
  | (Readonly<{ kind: 'save'; id: string; name: string; rule: string; rolloutPercent: number; expectedVersion: number }> & ApprovalFields)
  | (Readonly<{ kind: 'activate'; policy: RiskPolicy; rolloutPercent: number; expectedVersion: number }> & ApprovalFields)
  | (Readonly<{ kind: 'retire'; policy: RiskPolicy; expectedVersion: number }> & ApprovalFields)
  | (Readonly<{ kind: 'case'; riskCase: RiskCase; action: RiskCaseAction; reason: string; evidence: string; expectedVersion: number }> & ApprovalFields);

export type RiskPolicyCommand =
  | Readonly<{ action: 'save'; policy: string; name: string; rule: RiskRule; rolloutPercent: number; expectedVersion: number; proof: string; identity: string }>
  | Readonly<{ action: 'activate'; policy: string; version: number; rolloutPercent: number; expectedVersion: number; proof: string; identity: string }>
  | Readonly<{ action: 'retire'; policy: string; expectedVersion: number; proof: string; identity: string }>;

export interface RiskCaseCommand {
  readonly case: string;
  readonly action: RiskCaseAction;
  readonly reason: string;
  readonly evidence: Readonly<Record<string, ContractJsonValue>>;
  readonly expectedVersion: number;
  readonly proof: string;
  readonly identity: string;
}

export type RiskCommand = Readonly<{ kind: 'policy'; change: RiskPolicyCommand }> | Readonly<{ kind: 'case'; change: RiskCaseCommand }>;

export function riskInput(command: RiskCommand): Readonly<{ path: Readonly<Record<string, string>>; body: unknown }> {
  if (command.kind === 'case') return { path: { caseid: command.change.case }, body: { action: command.change.action, reason: command.change.reason, evidence: command.change.evidence } };
  const change = command.change;
  if (change.action === 'save') return { path: { policyid: change.policy }, body: { action: change.action, name: change.name, rule: change.rule, rolloutPercent: change.rolloutPercent } };
  if (change.action === 'activate') return { path: { policyid: change.policy }, body: { action: change.action, version: change.version, rolloutPercent: change.rolloutPercent } };
  return { path: { policyid: change.policy }, body: { action: change.action } };
}

export function parseRiskRule(source: string): RiskRule {
  const rule = object(source, '策略规则');
  const allowed = new Set(['blockedActors', 'denyOperations', 'reviewOperations', 'challengeOperations', 'maximumAmountMinor', 'reviewAmountMinor', 'velocity', 'scores', 'thresholds']);
  if (Object.keys(rule).some((key) => !allowed.has(key))) throw new Error('规则包含服务端不支持的字段。');
  return rule;
}

export function parseEvidence(source: string): Readonly<Record<string, ContractJsonValue>> {
  if (source.length > 16_384) throw new Error('复核证据不能超过 16,384 个字符。');
  return object(source, '复核证据');
}

export function saveEditor(policy: RiskPolicy | undefined, id: string): Extract<RiskEditor, { kind: 'save' }> {
  const rule = policy?.candidateRule ?? policy?.rule ?? {};
  return Object.freeze({
    kind: 'save',
    id: policy?.id ?? id,
    name: policy?.name ?? '',
    rule: JSON.stringify(rule, null, 2),
    rolloutPercent: policy?.candidateRollout ?? policy?.rolloutPercent ?? 100,
    expectedVersion: policy?.version ?? 0,
    proof: '',
    confirmed: false,
  });
}

export function caseEditor(riskCase: RiskCase, action: RiskCaseAction): Extract<RiskEditor, { kind: 'case' }> {
  return Object.freeze({ kind: 'case', riskCase, action, reason: '', evidence: '{}', expectedVersion: riskCase.version, proof: '', confirmed: false });
}

function object(source: string, name: string): Readonly<Record<string, ContractJsonValue>> {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`${name}必须是合法 JSON。`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name}顶层必须是 JSON 对象。`);
  return value as Readonly<Record<string, ContractJsonValue>>;
}
