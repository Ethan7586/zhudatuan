import { DomainError } from '../../../../foundation/domain/DomainError';
import { isOperationTarget, type OperationTarget } from '@shop/contract';
export class FederationPolicy {
  assertPkce(value: string): void {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(value)) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
  }
  assertBrowser(value: string): void {
    if (!/^[0-9a-f]{64}$/.test(value)) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
  }
  assertTarget(value: unknown): asserts value is OperationTarget {
    if (!isOperationTarget(value)) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
  }
}
