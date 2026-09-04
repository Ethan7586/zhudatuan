import type { VariableSchema, VariableType } from './Template';
import { z } from 'zod';

const JsonObjectSchema = z.record(z.string(), z.unknown());

export interface TemplatePreview {
  readonly subject: string | null;
  readonly body: string;
  readonly characters: number;
  readonly segments: number;
}

export function readVariableSchema(source: string): VariableSchema {
  const value = jsonObject(source, '变量定义必须是 JSON 对象。');
  const entries = Object.entries(value);
  if (entries.length > 64) throw new Error('变量最多定义 64 项。');
  const result: Record<string, VariableType> = {};
  for (const [name, type] of entries) {
    if (!/^[a-z][a-zA-Z0-9]{0,63}$/.test(name)) throw new Error(`变量名“${name}”必须以小写字母开头，且只能包含字母和数字。`);
    if (!['string', 'number', 'boolean', 'date', 'money'].includes(String(type))) throw new Error(`变量“${name}”的类型无效。`);
    result[name] = type as VariableType;
  }
  return Object.freeze(result);
}

export function createTemplatePreview(subject: string | null, body: string, schema: VariableSchema, sampleSource: string): TemplatePreview {
  if (!body.trim() || body.length > 10_000) throw new Error('正文必填且最多 10,000 个字符。');
  if (subject !== null && subject.length > 500) throw new Error('主题最多 500 个字符。');
  assertPlaceholders(subject ?? '', schema);
  assertPlaceholders(body, schema);
  const source = jsonObject(sampleSource, '预览数据必须是 JSON 对象。');
  const schemaNames = Object.keys(schema);
  const unknown = Object.keys(source).find((name) => !Object.hasOwn(schema, name));
  if (unknown) throw new Error(`预览数据包含未定义变量“${unknown}”。`);
  const samples: Record<string, string | number | boolean> = {};
  for (const name of schemaNames) samples[name] = variable(source[name], schema[name]!, name);
  const renderedBody = render(body, samples);
  const characters = [...renderedBody].length;
  return Object.freeze({ subject: subject === null ? null : render(subject, samples), body: renderedBody, characters, segments: Math.max(1, Math.ceil(characters / 70)) });
}

function jsonObject(source: string, message: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(message);
  }
  const result = JsonObjectSchema.safeParse(parsed);
  if (!result.success) throw new Error(message);
  return result.data;
}

function variable(value: unknown, type: VariableType, name: string): string | number | boolean {
  if ((type === 'string' || type === 'money') && typeof value === 'string' && value.length <= 2_000) return value;
  if (type === 'date' && typeof value === 'string' && value.length <= 64 && !Number.isNaN(Date.parse(value))) return value;
  if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
  if (type === 'boolean' && typeof value === 'boolean') return value;
  throw new Error(`预览变量“${name}”缺失或类型不匹配。`);
}

function assertPlaceholders(value: string, schema: VariableSchema): void {
  for (const match of value.matchAll(/\{\{([^{}]+)\}\}/g)) if (!Object.hasOwn(schema, match[1]!)) throw new Error(`占位符“${match[1]}”未在变量定义中声明。`);
  if (value.replace(/\{\{[^{}]+\}\}/g, '').includes('{{') || value.replace(/\{\{[^{}]+\}\}/g, '').includes('}}')) throw new Error('存在未闭合的变量占位符。');
}

function render(value: string, samples: Readonly<Record<string, string | number | boolean>>): string {
  return value.replace(/\{\{([a-z][a-zA-Z0-9]{0,63})\}\}/g, (_match, name: string) => String(samples[name]));
}
