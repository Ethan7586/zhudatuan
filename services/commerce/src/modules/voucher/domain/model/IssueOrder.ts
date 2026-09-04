import { DomainError } from '../../../../foundation/domain/DomainError';
import { IssuePolicy } from '../policy/IssuePolicy';

export type IssueOrderState = 'draft' | 'submitted' | 'approved' | 'issuing' | 'completed' | 'failed' | 'cancelled';
export interface IssueOrderValue { readonly id: string; readonly scope: string; readonly customer: string; readonly product: string; readonly stockRequest: string; readonly quantity: number; readonly purpose: 'benefit' | 'order' | 'campaign' | 'manual'; readonly delivery: 'account' | 'claim'; readonly startsAt: Date; readonly expiresAt: Date; readonly recipientSnapshot: string; readonly reason: string; readonly requester: string; readonly approval: string | null; readonly state: IssueOrderState; readonly version: number; }
export class IssueOrder {
  constructor(readonly value: IssueOrderValue) { new IssuePolicy().validateOrder(value); }
  revise(input: Pick<IssueOrderValue, 'customer' | 'product' | 'stockRequest' | 'quantity' | 'purpose' | 'delivery' | 'startsAt' | 'expiresAt' | 'recipientSnapshot' | 'reason'>): IssueOrder {
    if (this.value.state !== 'draft') throw new DomainError('VOUCHER_STATE_INVALID');
    return new IssueOrder(Object.freeze({ ...this.value, ...input, version: this.value.version + 1 }));
  }
  submit(approval: string): IssueOrder {
    if (this.value.state !== 'draft' || !approval) throw new DomainError('VOUCHER_APPROVAL_REQUIRED');
    return new IssueOrder(Object.freeze({ ...this.value, approval, state: 'submitted', version: this.value.version + 1 }));
  }
  start(): IssueOrder {
    if (this.value.state !== 'approved' || !this.value.approval) throw new DomainError('VOUCHER_APPROVAL_REQUIRED');
    return new IssueOrder(Object.freeze({ ...this.value, state: 'issuing', version: this.value.version + 1 }));
  }
  cancel(): IssueOrder {
    if (!['draft', 'submitted'].includes(this.value.state)) throw new DomainError('VOUCHER_STATE_INVALID');
    return new IssueOrder(Object.freeze({ ...this.value, state: 'cancelled', version: this.value.version + 1 }));
  }
}
