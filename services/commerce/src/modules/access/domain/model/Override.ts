import { DomainError } from '../../../../foundation/domain/DomainError';

export interface OverrideValue {
  readonly membership: string;
  readonly permission: string;
  readonly effect: 'allow' | 'deny';
  readonly reason: string;
  readonly effectiveat: Date;
  readonly expiresat: Date | null;
}

export class Override implements OverrideValue {
  readonly membership: string;
  readonly permission: string;
  readonly effect: 'allow' | 'deny';
  readonly reason: string;
  readonly effectiveat: Date;
  readonly expiresat: Date | null;
  constructor(value: OverrideValue) {
    if (
      !/^[a-z][a-z0-9:.-]{2,127}$/.test(value.membership) ||
      !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(value.permission) ||
      !['allow', 'deny'].includes(value.effect) ||
      value.reason.trim().length < 3 ||
      value.reason.trim().length > 500 ||
      !Number.isFinite(value.effectiveat.getTime()) ||
      (value.expiresat !== null && (!Number.isFinite(value.expiresat.getTime()) || value.expiresat <= value.effectiveat))
    )
      throw new DomainError('VALIDATION_FAILED');
    this.membership = value.membership;
    this.permission = value.permission;
    this.effect = value.effect;
    this.reason = value.reason.trim();
    this.effectiveat = new Date(value.effectiveat);
    this.expiresat = value.expiresat === null ? null : new Date(value.expiresat);
    Object.freeze(this);
  }
}
