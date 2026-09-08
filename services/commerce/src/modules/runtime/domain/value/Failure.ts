export interface TaskFailure {
  readonly code: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
}

export function taskFailure(code: string, retryable: boolean, occurredAt: string): TaskFailure {
  if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(code) || Number.isNaN(Date.parse(occurredAt))) throw new Error('RUNTIME_TASK_FAILURE_INVALID');
  return Object.freeze({ code, retryable, occurredAt });
}

export function importCode(cause: unknown, fallback: string): string {
  if (cause instanceof ApplicationError) return cause.code;
  if (cause instanceof Error && /^[A-Z][A-Z0-9_:.-]{0,99}$/.test(cause.message)) return cause.message;
  return fallback;
}

export function importDetail(cause: unknown): string {
  return cause instanceof ApplicationError || (cause instanceof Error && /^[A-Z][A-Z0-9_:.-]{0,99}$/.test(cause.message)) ? cause.message : '该行未通过校验';
}
import { ApplicationError } from '../../../../platform/error/ApplicationError';
