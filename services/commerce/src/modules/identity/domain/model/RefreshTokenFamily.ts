import { timingSafeEqual } from 'node:crypto';
import { DomainError } from '../../../../platform/error/DomainError';

export interface RefreshToken {
  readonly id: string;
  readonly hash: string;
  readonly sequence: number;
  readonly issuedAt: Date;
}

export class RefreshTokenFamily {
  readonly id: string;
  readonly session: string;
  readonly current: RefreshToken;

  constructor(value: Readonly<{ id: string; session: string; current: RefreshToken }>) {
    if (!value.id.startsWith('tokenfamily:') || !value.session.startsWith('session:') || !valid(value.current)) throw new Error('REFRESH_TOKEN_FAMILY_INVALID');
    this.id = value.id;
    this.session = value.session;
    this.current = Object.freeze({ ...value.current });
    Object.freeze(this);
  }

  rotate(presentedHash: string, next: Readonly<{ id: string; hash: string }>, issuedAt: Date): RefreshTokenFamily {
    if (!same(this.current.hash, presentedHash) || !next.id.startsWith('refreshtoken:') || !/^[0-9a-f]{64}$/.test(next.hash) || !Number.isFinite(issuedAt.getTime())) {
      throw new DomainError('AUTH_TICKET_EXCHANGE_REJECTED');
    }
    return new RefreshTokenFamily({
      id: this.id,
      session: this.session,
      current: { id: next.id, hash: next.hash, sequence: this.current.sequence + 1, issuedAt },
    });
  }
}

function valid(token: RefreshToken): boolean {
  return token.id.startsWith('refreshtoken:') && /^[0-9a-f]{64}$/.test(token.hash) && Number.isSafeInteger(token.sequence) && token.sequence >= 0 && Number.isFinite(token.issuedAt.getTime());
}

function same(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
