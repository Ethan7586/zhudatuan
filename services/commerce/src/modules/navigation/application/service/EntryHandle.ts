import { parseStorefrontHandle, type StorefrontHandle } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';

export function entryHandle(context: Pick<HandlerContext, 'headers'>): StorefrontHandle {
  try {
    return parseStorefrontHandle(context.headers['x-storefront-handle']);
  } catch {
    throw new DomainError('STOREFRONT_HANDLE_INVALID');
  }
}

export function assertEntryMall(context: Pick<HandlerContext, 'security'>, mall: string): void {
  if (context.security.kind !== 'session') return;
  if (context.security.access.organization === mall) return;
  throw new DomainError('STOREFRONT_MEMBERSHIP_MALL_MISMATCH');
}
