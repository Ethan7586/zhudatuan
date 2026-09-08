import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { type OperationId } from '@shop/contract';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface ActionProofBinding {
  readonly operation: OperationId;
  readonly resource: string;
  readonly requestHash: string;
  readonly expectedVersion: number | null;
  readonly makerMembership: string;
}
export interface ActionProofChecker {
  readonly membership: string;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly accessVersion: number;
}
export interface AuthorizedActionProof {
  readonly binding: ActionProofBinding;
  readonly checker: ActionProofChecker;
  readonly scope: string;
}
export interface ActionProofPort {
  validate(context: ReadTransactionContext, binding: ActionProofBinding, checker: ActionProofChecker): Promise<AuthorizedActionProof>;
  issue(
    context: WriteTransactionContext,
    binding: ActionProofBinding,
    checker: ActionProofChecker
  ): Promise<
    Readonly<{
      proof: string;
      expiresAt: string;
    }>
  >;
}
export const ACTION_PROOF_PORT = publicPort<ActionProofPort>('access', 'actionproof');
