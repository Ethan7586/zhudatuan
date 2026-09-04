export type FederationType = 'wechat' | 'wecomcorp' | 'wecomsuite' | 'oidc';
export interface FederationProvider {
  readonly id: string;
  readonly type: FederationType;
  readonly status: 'enabled';
}
export interface FederationCenter {
  readonly items: readonly FederationProvider[];
  readonly count: number;
}
export interface FederationHealth {
  readonly provider: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable';
  readonly checkedAt: string;
}
