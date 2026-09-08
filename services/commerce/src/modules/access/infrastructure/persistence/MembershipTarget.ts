import { isOperationTarget, type OperationTarget } from '@shop/contract';

export function membershipTarget(value: string): OperationTarget {
  const target = value === 'operator' ? 'console' : value;
  if (!isOperationTarget(target) || target === 'miniapp') throw new Error('MEMBERSHIP_CLIENT_INVALID');
  return target;
}
