import { DomainError } from '../../../../foundation/domain/DomainError';
import { BindingPolicy } from '../policy/BindingPolicy';
import { VoucherValue as Balance } from '../value/VoucherValue';

export type VoucherState = 'generated' | 'available' | 'allocated' | 'bound' | 'active' | 'held' | 'redeemed' | 'disabled' | 'void' | 'reversed' | 'expired';
export interface VoucherValue { readonly id: string; readonly credential: string; readonly product: string; readonly holder: string | null; readonly initialMinor: number; readonly remainingMinor: number; readonly state: VoucherState; readonly startsAt: Date; readonly expiresAt: Date; readonly version: number; }
export class Voucher {
  constructor(readonly value: VoucherValue) {
    if (!Number.isSafeInteger(value.initialMinor) || !Number.isSafeInteger(value.remainingMinor) || value.initialMinor <= 0 || value.remainingMinor < 0 || value.remainingMinor > value.initialMinor || !Number.isFinite(value.startsAt.getTime()) || !Number.isFinite(value.expiresAt.getTime()) || value.expiresAt <= value.startsAt) throw new DomainError('VOUCHER_STATE_INVALID');
  }
  bind(holder: string): Voucher { new BindingPolicy().bind(this.value, holder); return this.move('bound', { holder }); }
  unbind(): Voucher { new BindingPolicy().unbind(this.value); return this.move('available', { holder: null }); }
  activate(now: Date, holder?: string): Voucher {
    if (holder !== undefined) new BindingPolicy().bind(this.value, holder);
    if (!['available', 'allocated', 'bound'].includes(this.value.state) || now < this.value.startsAt || now >= this.value.expiresAt) throw new DomainError('VOUCHER_STATE_INVALID');
    return this.move('active', { holder: holder ?? this.value.holder });
  }
  disable(): Voucher {
    if (!['active', 'held'].includes(this.value.state)) throw new DomainError('VOUCHER_STATE_INVALID');
    return this.move('disabled');
  }
  enable(now: Date): Voucher {
    if (this.value.state !== 'disabled' || now < this.value.startsAt || now >= this.value.expiresAt) throw new DomainError('VOUCHER_STATE_INVALID');
    return this.move('active');
  }
  void(): Voucher {
    if (!['generated', 'available', 'allocated', 'bound', 'disabled'].includes(this.value.state) || this.value.remainingMinor !== this.value.initialMinor) throw new DomainError('VOUCHER_STATE_INVALID');
    return this.move('void');
  }
  extend(expiresAt: Date, now: Date): Voucher {
    if (['redeemed', 'void', 'reversed', 'expired'].includes(this.value.state) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= this.value.expiresAt || expiresAt <= now) throw new DomainError('VOUCHER_STATE_INVALID');
    return this.move(this.value.state, { expiresAt });
  }
  hold(): Voucher { if (this.value.state !== 'active') throw new DomainError('VOUCHER_NOT_USABLE'); return this.move('held'); }
  release(now: Date): Voucher { if (this.value.state !== 'held') throw new DomainError('VOUCHER_HOLD_CONFLICT'); return this.move(now >= this.value.expiresAt ? 'expired' : 'active'); }
  redeem(amount: number): Voucher {
    return this.spend(amount, 'held');
  }
  redeemAtomic(amount: number): Voucher {
    return this.spend(amount, 'active');
  }
  private spend(amount: number, state: 'active' | 'held'): Voucher {
    if (this.value.state !== state || !Number.isSafeInteger(amount) || amount <= 0 || amount > this.value.remainingMinor) throw new DomainError('VOUCHER_NOT_REDEEMABLE');
    const remainingMinor = new Balance(this.value.remainingMinor).subtract(amount).minor;
    return this.move(remainingMinor === 0 ? 'redeemed' : 'active', { remainingMinor });
  }
  refund(amount: number): Voucher {
    if (!['redeemed', 'active', 'reversed'].includes(this.value.state) || !Number.isSafeInteger(amount) || amount <= 0 || this.value.remainingMinor + amount > this.value.initialMinor) throw new DomainError('VOUCHER_REFUND_EXCEEDS_REDEMPTION');
    const remainingMinor = this.value.remainingMinor + amount;
    return this.move(this.value.state === 'active' ? 'active' : 'reversed', { remainingMinor });
  }
  private move(state: VoucherState, change: Partial<VoucherValue> = {}): Voucher { return new Voucher(Object.freeze({ ...this.value, ...change, state, version: this.value.version + 1 })); }
}
