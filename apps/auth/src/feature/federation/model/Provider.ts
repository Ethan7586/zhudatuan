export interface Provider {
  readonly id: string;
  readonly type: 'wechat' | 'wecomcorp' | 'wecomsuite' | 'oidc';
}

export interface FederationRedirect {
  readonly redirectUrl: string;
}
