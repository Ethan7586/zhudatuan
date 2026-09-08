import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface SessionIssue {
  readonly principal: string;
  readonly membership: string;
  readonly assurance: number;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly device: string;
  readonly peer: string;
  readonly agent: string;
  readonly trace: string;
  readonly expectedAccessVersion?: number;
}
export interface IssuedSession {
  readonly session: string;
  readonly membership: string;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly expiresin: number;
  readonly headers: Readonly<Record<string, string>>;
}
export interface SessionIssuer {
  issue(context: WriteTransactionContext, value: SessionIssue): Promise<IssuedSession>;
}
