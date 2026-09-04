import { DomainError } from '../../../../foundation/domain/DomainError';
import { Validity } from '../value/Validity';
export class IssuePolicy {
  validateRequest(value: Readonly<{ customer: string; product: string; pool: string; quantity: number; reason: string; requester: string }>): void {
    if (!value.customer || !value.product || !value.pool || !value.requester || !Number.isSafeInteger(value.quantity) || value.quantity <= 0 || value.quantity > 1_000_000 || value.reason.trim().length < 2) throw new DomainError('VALIDATION_FAILED');
  }
  validateOrder(value: Readonly<{ customer: string; product: string; stockRequest: string; quantity: number; startsAt: Date; expiresAt: Date; recipientSnapshot: string; requester: string }>): void {
    if (!value.customer || !value.product || !value.stockRequest || !value.recipientSnapshot || !value.requester || !Number.isSafeInteger(value.quantity) || value.quantity <= 0 || value.quantity > 1_000_000) throw new DomainError('VALIDATION_FAILED');
    new Validity(value.startsAt, value.expiresAt);
  }
  separate(requester: string, checker: string): void { if (requester === checker) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED'); }
}
