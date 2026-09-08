import { DomainError } from '../../../../platform/error/DomainError';
export type FederationState = 'created' | 'redirected' | 'callbackreceived' | 'verified' | 'selectionrequired' | 'linkrequired' | 'completed' | 'expired' | 'rejected';

const NEXT: Readonly<Record<FederationState, readonly FederationState[]>> = Object.freeze({
  created: Object.freeze<FederationState[]>(['redirected', 'expired', 'rejected']),
  redirected: Object.freeze<FederationState[]>(['callbackreceived', 'expired', 'rejected']),
  callbackreceived: Object.freeze<FederationState[]>(['verified', 'expired', 'rejected']),
  verified: Object.freeze<FederationState[]>(['selectionrequired', 'linkrequired', 'completed', 'rejected']),
  selectionrequired: Object.freeze<FederationState[]>(['completed', 'rejected']),
  linkrequired: Object.freeze<FederationState[]>(['completed', 'rejected']),
  completed: Object.freeze<FederationState[]>([]),
  expired: Object.freeze<FederationState[]>([]),
  rejected: Object.freeze<FederationState[]>([]),
});

export interface FederationTransactionValue {
  readonly id: string;
  readonly provider: string;
  readonly state: FederationState;
  readonly version: number;
  readonly expiresat: Date;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly purpose: 'signin' | 'link';
  readonly principal: string | null;
  readonly membership: string | null;
}

export class FederationTransaction implements FederationTransactionValue {
  readonly id: string;
  readonly provider: string;
  readonly state: FederationState;
  readonly version: number;
  readonly expiresat: Date;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly purpose: 'signin' | 'link';
  readonly principal: string | null;
  readonly membership: string | null;
  constructor(value: FederationTransactionValue) {
    if (!/^[0-9a-f-]{36}$/.test(value.id) || !/^[0-9a-f-]{36}$/.test(value.provider) || !Number.isSafeInteger(value.version) || value.version < 0 || Number.isNaN(value.expiresat.getTime())) invalid();
    this.id = value.id;
    this.provider = value.provider;
    this.state = value.state;
    this.version = value.version;
    this.expiresat = value.expiresat;
    this.target = value.target;
    this.purpose = value.purpose;
    this.principal = value.principal;
    this.membership = value.membership;
    if ((value.purpose === 'link') !== (value.principal !== null && value.membership !== null)) invalid();
    Object.freeze(this);
  }
  transition(next: FederationState, now: Date): FederationTransaction {
    if (now >= this.expiresat && next !== 'expired') throw new DomainError('FEDERATION_TRANSACTION_EXPIRED');
    if (!NEXT[this.state].includes(next)) throw new DomainError(this.state === 'completed' ? 'FEDERATION_TRANSACTION_CONSUMED' : 'FEDERATION_TRANSACTION_INVALID');
    return new FederationTransaction({ ...this, state: next, version: this.version + 1 });
  }
}
function invalid(): never {
  throw new DomainError('FEDERATION_TRANSACTION_INVALID');
}
