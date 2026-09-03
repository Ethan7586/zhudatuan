import type { FailureAction } from './Action';
import { failure, type Failure } from './Failure';
import type { FailureView, MessageLocale } from './Message';
import { errorPolicy } from './generated/ErrorPolicy';
import { CHINESE_ACTIONS, CHINESE_TITLES } from './locale/Chinese';
import { ENGLISH_ACTIONS, ENGLISH_TITLES } from './locale/English';

export function presentError(cause: unknown, locale: MessageLocale = 'zh-CN'): FailureView {
  return presentFailure(failure(cause), locale);
}

export function safeQueryError(cause: unknown): string | undefined {
  return cause === null || cause === undefined ? undefined : presentError(cause).message;
}

export function presentFailure(value: Failure, locale: MessageLocale = 'zh-CN'): FailureView {
  const policy = errorPolicy(value.code) ?? errorPolicy('UNEXPECTED_FAILURE');
  if (policy === undefined) throw new Error('PRESENTATION_POLICY_MISSING');
  const chinese = locale === 'zh-CN';
  const action = policy.action as FailureAction;
  const titles = chinese ? CHINESE_TITLES : ENGLISH_TITLES;
  const actions = chinese ? CHINESE_ACTIONS : ENGLISH_ACTIONS;
  return Object.freeze({
    title: titles[policy.category],
    message: policy.exposure === 'hidden' ? (chinese ? '系统暂时无法完成操作，请稍后重试。' : 'The operation could not be completed.') : chinese ? policy.message : policy.english,
    severity: policy.category === 'internal' || policy.category === 'dependency' ? 'danger' : policy.category === 'rate' || policy.category === 'conflict' ? 'warning' : 'info',
    action: Object.freeze({ kind: action, label: actions[action] }),
    retryable: value.retryable,
    ...(value.requestId === undefined ? {} : { requestId: value.requestId }),
    ...(value.retryAfter === undefined ? {} : { retryAfter: value.retryAfter }),
  });
}
