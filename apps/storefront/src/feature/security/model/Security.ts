import type { DeviceSession } from './DeviceSession';

export interface Security {
  readonly sessionId: string;
  readonly assurance: number;
  readonly hasLocalCredential: boolean;
  readonly phoneMasked: string | null;
  readonly passwordChangedAt: string | null;
  readonly sessions: readonly DeviceSession[];
}
