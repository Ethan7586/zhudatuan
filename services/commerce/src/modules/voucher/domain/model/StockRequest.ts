import { DomainError } from '../../../../foundation/domain/DomainError';
import { IssuePolicy } from '../policy/IssuePolicy';

export type StockRequestState = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'fulfilled';
export interface StockRequestValue { readonly id: string; readonly scope: string; readonly customer: string; readonly product: string; readonly pool: string; readonly quantity: number; readonly reason: string; readonly requester: string; readonly approval: string | null; readonly state: StockRequestState; readonly version: number; }
export class StockRequest {
  constructor(readonly value: StockRequestValue) { new IssuePolicy().validateRequest(value); }
  revise(input: Pick<StockRequestValue, 'customer' | 'product' | 'pool' | 'quantity' | 'reason'>): StockRequest {
    if (this.value.state !== 'draft') throw new DomainError('VOUCHER_STATE_INVALID');
    return new StockRequest(Object.freeze({ ...this.value, ...input, version: this.value.version + 1 }));
  }
  submit(approval: string): StockRequest {
    this.assertSubmittable();
    if (!approval) throw new DomainError('VOUCHER_APPROVAL_REQUIRED');
    return new StockRequest(Object.freeze({ ...this.value, approval, state: 'submitted', version: this.value.version + 1 }));
  }
  assertSubmittable(): void {
    if (this.value.state !== 'draft') throw new DomainError('VOUCHER_STATE_INVALID');
  }
  decide(approved: boolean): StockRequest {
    if (this.value.state !== 'submitted') throw new DomainError('VOUCHER_STATE_INVALID');
    return new StockRequest(Object.freeze({ ...this.value, state: approved ? 'approved' : 'rejected', version: this.value.version + 1 }));
  }
  cancel(): StockRequest {
    if (!['draft', 'submitted'].includes(this.value.state)) throw new DomainError('VOUCHER_STATE_INVALID');
    return new StockRequest(Object.freeze({ ...this.value, state: 'cancelled', version: this.value.version + 1 }));
  }
}
