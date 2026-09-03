import type { RequestScope } from '@shop/sdk';

export interface StorefrontSession {
  readonly membership: string;
  readonly scope: RequestScope;
  readonly accessVersion: number;
  readonly csrfToken: string | null;
}
