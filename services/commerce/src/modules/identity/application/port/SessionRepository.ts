import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

import type { Session } from '../../domain/model/Session';
import type { RefreshTokenFamily } from '../../domain/model/RefreshTokenFamily';
import type { QueryPage } from '../../../../pipeline/Validation';

export interface SessionRecord {
  readonly session: Session;
  readonly tokenFamily: RefreshTokenFamily;
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
  readonly client: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
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
  revokeCurrent(context: WriteTransactionContext, principal: string, session: string, reason?: 'logout' | 'membership_switch' | 'store_handover'): Promise<SessionRevocation | null>;
  revokeSelected(context: WriteTransactionContext, principal: string, current: string, target: string): Promise<readonly string[]>;
  owns(context: ReadTransactionContext, principal: string, session: string): Promise<boolean>;
  elevate(context: WriteTransactionContext, principal: string, session: string, assurance: 1 | 2 | 3): Promise<boolean>;
  lower(context: WriteTransactionContext, principal: string, session: string): Promise<1 | 2 | null>;
  list(context: ReadTransactionContext, principal: string, current: string, page: QueryPage): Promise<readonly SessionListRecord[]>;
  advance(context: WriteTransactionContext, principal: string): Promise<number>;
}
