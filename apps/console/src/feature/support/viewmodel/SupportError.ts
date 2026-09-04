import { hasFailureCode, presentError } from '@shop/presentation';

export function supportActionError(cause: unknown): string {
  return hasFailureCode(cause, 'VERSION_CONFLICT') ? '工单已被其他客服更新，已刷新最新状态；请确认后重新操作。' : presentError(cause).message;
}
