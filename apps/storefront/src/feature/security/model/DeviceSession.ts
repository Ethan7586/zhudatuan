import type { OperationTarget } from '@shop/contract';

export interface DeviceSession {
  readonly id: string;
  readonly client: OperationTarget;
  readonly deviceLabel: string;
  readonly userAgent: string;
  readonly assurance: number;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly current: boolean;
}
