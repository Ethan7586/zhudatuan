import type { ContractJsonValue } from '@shop/contract';
import type { QualificationPolicy } from './Policy';

export type QualificationEditor =
  | Readonly<{ kind: 'publish'; id: string; name: string; rule: string; expectedVersion: number; proof: string; confirmed: boolean }>
  | Readonly<{ kind: 'rollback'; policy: QualificationPolicy; version: number; expectedVersion: number; proof: string; confirmed: boolean }>
  | Readonly<{ kind: 'decision'; member: string; resource: string }>;

export type PolicyPreviewCommand = Readonly<{ kind: 'publish'; policy: string; name: string; rule: Readonly<Record<string, ContractJsonValue>> }> | Readonly<{ kind: 'rollback'; policy: string; version: number }>;

export type PolicyManageCommand =
  | Readonly<{ action: 'publish'; policy: string; name: string; rule: Readonly<Record<string, ContractJsonValue>>; expectedVersion: number; proof: string; identity: string }>
  | Readonly<{ action: 'rollback'; policy: string; version: number; expectedVersion: number; proof: string; identity: string }>;

export function parsePolicyRule(source: string): Readonly<Record<string, ContractJsonValue>> {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('规则必须是合法的 JSON 对象。');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('规则顶层必须是 JSON 对象。');
  if (source.length > 50_000) throw new Error('规则内容不能超过 50,000 个字符。');
  return value as Readonly<Record<string, ContractJsonValue>>;
}

export function publishEditor(policy: QualificationPolicy | undefined, id: string): Extract<QualificationEditor, { kind: 'publish' }> {
  return Object.freeze({ kind: 'publish', id: policy?.id ?? id, name: policy?.name ?? '', rule: JSON.stringify(policy?.rule ?? { effect: 'allow' }, null, 2), expectedVersion: policy?.activeVersion ?? 0, proof: '', confirmed: false });
}
