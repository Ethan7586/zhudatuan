import type { MiniappRuntime } from '../../runtime/MiniappRuntime';
import type { MiniappInstance } from '../../platform/Wechat';

export function currentRuntime(): MiniappRuntime {
  const application = getApp<MiniappInstance>();
  if (application.runtime !== undefined) return application.runtime;
  throw application.startupError ?? new Error('MINIAPP_RUNTIME_UNAVAILABLE');
}

export function detail(event: unknown, key: string): string {
  const target = event !== null && typeof event === 'object' ? Reflect.get(event, 'currentTarget') : undefined;
  const dataset = target !== null && typeof target === 'object' ? Reflect.get(target, 'dataset') : undefined;
  const value = dataset !== null && typeof dataset === 'object' ? Reflect.get(dataset, key) : undefined;
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) throw new Error('MINIAPP_DATASET_INVALID');
  return value;
}

export function inputValue(event: unknown): string {
  const detailValue = event !== null && typeof event === 'object' ? Reflect.get(event, 'detail') : undefined;
  const value = detailValue !== null && typeof detailValue === 'object' ? Reflect.get(detailValue, 'value') : undefined;
  if (typeof value !== 'string' || value.length > 6) throw new Error('MINIAPP_INPUT_INVALID');
  return value;
}

export function message(cause: unknown): string {
  try {
    return currentRuntime().failure(cause).message;
  } catch {
    return '系统暂时无法完成操作，请稍后重试。';
  }
}

export function failureCode(cause: unknown): string {
  if (cause === null || typeof cause !== 'object') return '';
  const code = Reflect.get(cause, 'code');
  return typeof code === 'string' ? code : '';
}

export function money(minor: number): string {
  return `¥${(minor / 100).toFixed(2)}`;
}
