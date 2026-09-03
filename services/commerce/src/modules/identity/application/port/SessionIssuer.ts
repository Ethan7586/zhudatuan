import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface SessionIssue {
  readonly principal: string;
  readonly membership: string;
  readonly assurance: number;
  readonly target: 'console' | 'storefront';
  readonly device: string;
  readonly peer: string;
  readonly agent: string;
  readonly trace: string;
  readonly expectedAccessVersion?: number;
}
export interface IssuedSession {
  readonly session: string;
  readonly membership: string;
  readonly target: 'console' | 'storefront';
  readonly expiresin: number;
  readonly headers: Readonly<Record<string, string>>;
}
export interface SessionIssuer {
  issue(context: WriteTransactionContext, value: SessionIssue): Promise<IssuedSession>;
}
