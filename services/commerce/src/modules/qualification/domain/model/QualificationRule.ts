import { createHash } from 'node:crypto';
import type { ContractJsonValue } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
const stringLists = ['cityCodes', 'requiredTags', 'excludedTags'] as const;

export class QualificationRule {
  readonly value: Readonly<Record<string, ContractJsonValue>>;
  readonly canonical: string;
  readonly hash: string;

  constructor(value: ContractJsonValue) {
    if (!isObject(value)) throw invalid('rule');
    validateTree(value, 0, { count: 0 });
    validateKnownFields(value);
    this.value = Object.freeze({ ...value });
    this.canonical = canonicalJson(value);
    if (Buffer.byteLength(this.canonical, 'utf8') > 50_000) throw invalid('rule');
    this.hash = createHash('sha256').update(this.canonical).digest('hex');
  }
}

export function changedRuleFields(current: ContractJsonValue | null, proposed: ContractJsonValue): readonly string[] {
  if (!isObject(current) || !isObject(proposed)) return Object.freeze(['rule']);
  const result: string[] = [];
  compare(current, proposed, '', result);
  return Object.freeze(result.slice(0, 100));
}

function compare(left: ContractJsonValue, right: ContractJsonValue, path: string, result: string[]): void {
  if (canonicalJson(left) === canonicalJson(right)) return;
  if (!isObject(left) || !isObject(right)) {
    result.push(path || 'rule');
    return;
  }
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  for (const key of keys) {
    if (result.length >= 100) return;
    const next = path ? `${path}.${key}` : key;
    if (!(key in left) || !(key in right)) result.push(next);
    else compare(left[key] as ContractJsonValue, right[key] as ContractJsonValue, next, result);
  }
}

function validateTree(value: ContractJsonValue, depth: number, state: { count: number }): void {
  state.count += 1;
  if (depth > 10 || state.count > 1_000) throw invalid('rule');
  if (typeof value === 'string' && value.length > 2_000) throw invalid('rule');
  if (Array.isArray(value)) {
    if (value.length > 500) throw invalid('rule');
    value.forEach((item) => validateTree(item, depth + 1, state));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(key) || blockedKeys.has(key)) throw invalid('rule');
    validateTree(item, depth + 1, state);
  }
}

function validateKnownFields(value: Readonly<Record<string, ContractJsonValue>>): void {
  if (value.effect !== undefined && value.effect !== 'allow' && value.effect !== 'deny') throw invalid('effect');
  if (value.allowed !== undefined && typeof value.allowed !== 'boolean') throw invalid('allowed');
  for (const field of stringLists) {
    const selected = value[field];
    if (selected === undefined) continue;
    if (!Array.isArray(selected) || selected.length > 200 || selected.some((item) => typeof item !== 'string' || item.trim().length === 0 || item.length > 128)) throw invalid(field);
    if (new Set(selected).size !== selected.length) throw invalid(field);
  }
}

function canonicalJson(value: ContractJsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObject(value))
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function isObject(value: ContractJsonValue | null): value is Readonly<Record<string, ContractJsonValue>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(field: string): DomainError {
  return new DomainError('VALIDATION_FAILED', { field });
}
