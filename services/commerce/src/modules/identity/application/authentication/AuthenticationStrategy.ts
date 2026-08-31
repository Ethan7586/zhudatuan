import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../../foundation/application/OperationExecution';
import type { OperationInputFor } from '@shop/contract';

export type AuthenticationBody = OperationInputFor<'identity.sessions.create'>['body'];

export interface SelectableMembership {
  readonly id: string;
  readonly target: 'console' | 'storefront';
}
export interface ProofView {
  readonly reference?: string;
  readonly expiresAt: string;
  readonly method: 'otp' | 'sso';
  readonly target: 'console' | 'storefront';
}
export interface EnrollmentView {
  readonly id: string;
  readonly expiresAt: string;
  readonly target: 'storefront';
}
export type AuthenticationResult =
  | Readonly<{ kind: 'session'; ticket: string; returnTarget: string }>
  | Readonly<{ kind: 'selection'; transaction: string; memberships: readonly SelectableMembership[] }>
  | Readonly<{ kind: 'proofRequired'; proof: ProofView }>
  | Readonly<{ kind: 'enrollment'; enrollment: EnrollmentView }>;
export interface AuthenticationReply {
  readonly result: AuthenticationResult;
  readonly status: 200 | 201 | 202;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface AuthenticationStrategy {
  readonly method: 'password' | 'otp' | 'invitation' | 'federation';
  authenticate(request: OperationRequest, database: OperationDatabase, body: AuthenticationBody): Promise<AuthenticationReply>;
}

export interface AuthenticationResolver {
  resolve(method: unknown): AuthenticationStrategy;
}
