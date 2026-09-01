import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { Session } from '../../domain/model/Session';
import type { QueryPage } from '../../../../foundation/interface/Validation';

export interface SessionRecord {
  readonly session: Session;
  readonly tokenHash: string;
  readonly ipHash: string;
  readonly userAgent: string;
  readonly deviceLabel: string;
  readonly trace: string;
}

export interface SessionRevocation {
  readonly id: string;
  readonly revokedAt: Date;
}

export interface SessionListRecord {
  readonly id: string;
  readonly membership: string;
  readonly client: 'console' | 'storefront';
  readonly deviceLabel: string;
  readonly userAgent: string;
  readonly assurance: number;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
  readonly current: boolean;
}

export interface SessionRepository {
  credentialVersion(context: WriteTransactionContext, principal: string): Promise<number>;
  create(context: WriteTransactionContext, value: SessionRecord): Promise<void>;
  revokeCurrent(context: WriteTransactionContext, principal: string, session: string): Promise<SessionRevocation | null>;
  revokeSelected(context: WriteTransactionContext, principal: string, current: string, target: string): Promise<readonly string[]>;
  owns(context: ReadTransactionContext, principal: string, session: string): Promise<boolean>;
  elevate(context: WriteTransactionContext, principal: string, session: string, assurance: 1 | 2 | 3): Promise<boolean>;
  list(context: ReadTransactionContext, principal: string, current: string, page: QueryPage): Promise<readonly SessionListRecord[]>;
  advance(context: WriteTransactionContext, principal: string): Promise<number>;
}
