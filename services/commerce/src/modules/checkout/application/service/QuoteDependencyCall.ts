import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { ApiErrorCode } from '@shop/contract';
import { Deadline } from '../../../../foundation/performance/Deadline';
import { DomainError } from '../../../../foundation/domain/DomainError';

export type QuoteDependency = 'benefit' | 'cart' | 'catalog' | 'experience' | 'finance' | 'inventory' | 'marketing' | 'member' | 'order' | 'pricing' | 'qualification' | 'risk' | 'voucher';

const TIMEOUTS: Readonly<Record<QuoteDependency, ApiErrorCode>> = Object.freeze({
  benefit: 'CHECKOUT_BENEFIT_TIMEOUT',
  cart: 'CHECKOUT_CART_TIMEOUT',
  catalog: 'CHECKOUT_CATALOG_TIMEOUT',
  experience: 'CHECKOUT_EXPERIENCE_TIMEOUT',
  finance: 'CHECKOUT_FINANCE_TIMEOUT',
  inventory: 'CHECKOUT_INVENTORY_TIMEOUT',
  marketing: 'CHECKOUT_MARKETING_TIMEOUT',
  member: 'CHECKOUT_MEMBER_TIMEOUT',
  order: 'CHECKOUT_ORDER_TIMEOUT',
  pricing: 'CHECKOUT_PRICING_TIMEOUT',
  qualification: 'CHECKOUT_QUALIFICATION_TIMEOUT',
  risk: 'CHECKOUT_RISK_TIMEOUT',
  voucher: 'CHECKOUT_VOUCHER_TIMEOUT',
});

export interface QuoteControl {
  readonly expiresAt: number;
  readonly signal: AbortSignal;
  readonly actor: string;
  readonly operation: 'checkout.quote.create' | 'order.orders.create';
  readonly trace: string;
  readonly scopes: readonly string[];
}

export class QuoteDependencyCall {
  constructor(private readonly timeoutMilliseconds: number = RUNTIME_LIMITS.checkout.dependencyTimeoutMilliseconds) {
    if (!Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1) throw new Error('CHECKOUT_DEPENDENCY_TIMEOUT_INVALID');
  }

  async execute<T>(dependency: QuoteDependency, control: Pick<QuoteControl, 'expiresAt' | 'signal'>, task: () => Promise<T>): Promise<T> {
    const dependencyExpiry = Date.now() + this.timeoutMilliseconds;
    const deadline = Deadline.at(Math.min(control.expiresAt, dependencyExpiry), control.signal);
    try {
      return await deadline.run(() => task());
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'DEADLINE_EXCEEDED') {
        if (control.expiresAt <= dependencyExpiry) throw new DomainError('DEADLINE_EXCEEDED');
        throw new DomainError(TIMEOUTS[dependency], { dependency });
      }
      throw cause;
    } finally {
      deadline.dispose();
    }
  }
}
