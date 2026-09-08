import type { RequestContext } from '@shop/sdk/context';

export function commandContext(context: RequestContext, expectedVersion?: number): RequestContext {
  return Object.freeze({ ...context, idempotencyKey: secureId('storecommand'), ...(expectedVersion === undefined ? {} : { expectedVersion }) });
}

export function clientMessageId(): string {
  return secureId('storemessage');
}

function secureId(prefix: string): string {
  if (typeof crypto.randomUUID === 'function') return `${prefix}:${crypto.randomUUID()}`;
  if (typeof crypto.getRandomValues !== 'function') throw new Error('当前环境无法安全生成操作编号，请更换浏览器后重试。');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}:${[...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}
