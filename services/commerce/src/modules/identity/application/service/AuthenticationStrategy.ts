import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

import type { OperationRequest } from '../../../../pipeline/OperationRequest';
import type { OperationResult } from '../../../../pipeline/OperationRequest';
import type { OperationInputFor } from '@shop/contract';
import type { MembershipView } from '../model/MembershipCandidate';

export type AuthenticationBody = OperationInputFor<'identity.sessions.create'>['body'];

export interface ProofView {
  readonly reference?: string;
  readonly expiresAt: string;
  readonly method: 'otp' | 'sso';
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
}
export interface EnrollmentView {
  readonly id: string;
  readonly expiresAt: string;
  readonly target: 'storefront';
}
export type AuthenticationResult =
  | Readonly<{ kind: 'session'; ticket: string; returnTarget: string }>
  | Readonly<{ kind: 'selection'; transaction: string; memberships: readonly MembershipView[] }>
  | Readonly<{ kind: 'proofRequired'; proof: ProofView }>
  | Readonly<{ kind: 'enrollment'; enrollment: EnrollmentView }>;
export interface AuthenticationReply {
  readonly result: AuthenticationResult;
  readonly status: 200 | 201 | 202;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface AuthenticationStrategy {
  readonly method: 'password' | 'otp' | 'federation';
  authenticate(request: OperationRequest, database: WriteTransactionContext, body: AuthenticationBody): Promise<AuthenticationReply>;
}

export interface AuthenticationResolver {
  resolve(method: unknown): AuthenticationStrategy;
}

export function authenticationOperationResult(reply: AuthenticationReply): OperationResult {
  return Object.freeze({ status: reply.status, body: reply.result, ...(reply.headers === undefined ? {} : { headers: reply.headers }) });
}
