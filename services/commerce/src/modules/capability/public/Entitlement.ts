export interface EntitlementInput {
  readonly id: string;
  readonly scope: string;
  readonly capability: string;
  readonly state: 'enabled' | 'disabled';
  readonly quota: number | null;
  readonly expiresAt: unknown;
  readonly expectedVersion: number | null;
}
