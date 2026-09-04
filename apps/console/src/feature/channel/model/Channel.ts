import {
  OP_CHANNEL_CONNECTIONS_CREATE,
  OP_CHANNEL_CONNECTIONS_DISABLE,
  OP_CHANNEL_CONNECTIONS_ENABLE,
  OP_CHANNEL_CONNECTIONS_READ,
  OP_CHANNEL_CONNECTIONS_TEST,
  OP_CHANNEL_CONNECTIONS_UPDATE,
  OP_CHANNEL_OPERATIONS_READ,
  OP_CHANNEL_OPERATIONS_REPLAY,
  OP_CHANNEL_SYNCRUNS_CANCEL,
  OP_CHANNEL_SYNCRUNS_READ,
  OP_CHANNEL_SYNCRUNS_START,
} from '@shop/contract/ids';
import { PROVIDER_REQUIREMENTS, type OperationId } from '@shop/contract';

export const channelViews = ['connections', 'syncs', 'operations'] as const;
export type ChannelView = (typeof channelViews)[number];
export type ConnectionState = 'draft' | 'testing' | 'enabled' | 'degraded' | 'disabled';
export type SyncKind = 'catalog' | 'price' | 'stock' | 'statement';
export type SyncState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type OperationState = 'queued' | 'submitted' | 'processing' | 'succeeded' | 'failed' | 'unknown';

export interface ChannelConnection {
  readonly type: 'connection';
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly state: ConnectionState;
  readonly contractVersion: string;
  readonly region: string;
  readonly limits: Readonly<{ connectionTimeoutMs: number; responseTimeoutMs: number; totalDeadlineMs: number; maxConcurrency: number; requestsPerSecond: number; maxAttempts: number; failureThreshold: number; recoveryMs: number }>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly hasSecret: boolean;
  readonly capabilities: readonly string[];
  readonly health: Readonly<{ state: 'healthy' | 'degraded' | 'unhealthy' | null; latencyMs: number | null; reason: string | null; checkedAt: string | null }>;
}

export interface ChannelSync {
  readonly type: 'sync';
  readonly id: string;
  readonly connection: string;
  readonly kind: SyncKind;
  readonly state: SyncState;
  readonly cursor: string | null;
  readonly inputHash: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly errors: readonly unknown[];
  readonly watermark: string | null;
  readonly pulled: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly version: number;
}

export interface ChannelOperation {
  readonly type: 'operation';
  readonly id: string;
  readonly provider: string;
  readonly kind: string;
  readonly internalReference: string;
  readonly externalReference: string | null;
  readonly state: OperationState;
  readonly response: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ChannelRecord = ChannelConnection | ChannelSync | ChannelOperation;
export interface ChannelPage {
  readonly items: readonly ChannelRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface ConnectionDraft {
  readonly provider: string;
  readonly region: string;
  readonly baseUrl?: string;
  readonly healthOperation: string;
  readonly endpoints: Readonly<Record<string, string>>;
  readonly secretRef: string;
}
export interface SyncDraft {
  readonly connection: string;
  readonly kind: SyncKind;
  readonly cursor?: string;
  readonly start?: string;
  readonly end?: string;
  readonly timezone?: string;
  readonly partner?: string;
}

export const channelProviders = Object.freeze(PROVIDER_REQUIREMENTS.filter(({ delivery }) => delivery === 'required').map(({ id, label }) => Object.freeze({ id, label })));
export const channelOperations = Object.freeze({
  readConnections: OP_CHANNEL_CONNECTIONS_READ,
  create: OP_CHANNEL_CONNECTIONS_CREATE,
  update: OP_CHANNEL_CONNECTIONS_UPDATE,
  test: OP_CHANNEL_CONNECTIONS_TEST,
  enable: OP_CHANNEL_CONNECTIONS_ENABLE,
  disable: OP_CHANNEL_CONNECTIONS_DISABLE,
  startSync: OP_CHANNEL_SYNCRUNS_START,
  readSyncs: OP_CHANNEL_SYNCRUNS_READ,
  cancelSync: OP_CHANNEL_SYNCRUNS_CANCEL,
  readOperations: OP_CHANNEL_OPERATIONS_READ,
  replay: OP_CHANNEL_OPERATIONS_REPLAY,
} satisfies Readonly<Record<string, OperationId>>);
