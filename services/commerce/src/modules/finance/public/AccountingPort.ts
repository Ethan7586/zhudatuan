import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';

export type AccountKind = 'asset' | 'liability' | 'income' | 'expense';

export interface PostingAccount {
  readonly code: string;
  readonly kind: AccountKind;
}

export interface PostingSource {
  readonly module: string;
  readonly aggregate: string;
  readonly aggregateId: string;
  readonly event: string;
  readonly eventId: string;
  readonly leg: string;
}

/** Stable module-to-finance command. It contains domain references, never SQL or table fields. */
export interface PostingCommand {
  readonly scopeId: string;
  readonly source: PostingSource;
  readonly currency: string;
  readonly description: string;
  readonly debit: PostingAccount;
  readonly credit: PostingAccount;
  readonly amountMinor: number;
  readonly occurredAt?: string;
}

export interface AccountCommand {
  readonly scopeId: string;
  readonly code: string;
  readonly currency: string;
  readonly kind: AccountKind;
}

export interface HoldCommand {
  readonly scopeId: string;
  readonly account: Readonly<{ code: string; currency: string; kind: AccountKind }>;
  readonly ownerType: string;
  readonly ownerId: string;
  readonly amountMinor: number;
  readonly expiresAt: string;
}

export interface AccountingPort {
  ensureAccount(context: WriteTransactionContext, command: AccountCommand): Promise<string>;
  post(context: WriteTransactionContext, command: PostingCommand): Promise<string>;
  hold(context: WriteTransactionContext, command: HoldCommand): Promise<string>;
  capture(context: WriteTransactionContext, holdId: string, command: PostingCommand): Promise<string>;
  release(context: WriteTransactionContext, holdId: string, scopeId: string): Promise<void>;
}
