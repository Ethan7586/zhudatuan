export interface MallScope {
  readonly kind: 'mall';
  readonly id: string;
}

export interface StorefrontSession {
  readonly membership: string;
  readonly scope: MallScope;
  readonly accessVersion: number;
  readonly csrfToken: string | null;
}
