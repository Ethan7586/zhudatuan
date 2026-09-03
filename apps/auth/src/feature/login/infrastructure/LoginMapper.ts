import type { OperationOutputFor } from '@shop/contract';
import { TransportError } from '@shop/sdk';
import type { LoginOutcome } from '../model/Login';

type SessionOutput = OperationOutputFor<'identity.sessions.create'> | OperationOutputFor<'identity.sessions.complete'>;

export function mapLogin(value: Exclude<SessionOutput, { kind: 'session' }>): LoginOutcome {
  switch (value.kind) {
    case 'selection': return Object.freeze({ kind: 'membership', transaction: value.transaction, memberships: Object.freeze(value.memberships.map((membership) => Object.freeze(membership))) });
    case 'proofRequired': {
      if (!value.proof.reference) throw new TransportError('CONTRACT_INVALID', undefined, false);
      return Object.freeze({ kind: 'proof', reference: value.proof.reference, expiresAt: value.proof.expiresAt, method: value.proof.method, target: value.proof.target });
    }
    case 'enrollment': return Object.freeze({ kind: 'enrollment', id: value.enrollment.id, expiresAt: value.enrollment.expiresAt });
  }
}
