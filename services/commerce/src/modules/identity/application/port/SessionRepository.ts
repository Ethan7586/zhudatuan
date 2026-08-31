import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
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
  credentialVersion(database: OperationDatabase, principal: string): Promise<number>;
  create(database: OperationDatabase, value: SessionRecord): Promise<void>;
  revokeCurrent(database: OperationDatabase, principal: string, session: string): Promise<SessionRevocation | null>;
  revokeSelected(database: OperationDatabase, principal: string, current: string, target: string): Promise<readonly string[]>;
  owns(database: OperationDatabase, principal: string, session: string): Promise<boolean>;
  elevate(database: OperationDatabase, principal: string, session: string, assurance: 1 | 2 | 3): Promise<boolean>;
  list(database: OperationDatabase, principal: string, current: string, page: QueryPage): Promise<readonly SessionListRecord[]>;
  advance(database: OperationDatabase, principal: string): Promise<number>;
}
