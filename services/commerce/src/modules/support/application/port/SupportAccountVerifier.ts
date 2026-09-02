import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';

export type SupportAccountProvider = 'inapp' | 'wechat' | 'email' | 'sms';

export interface SupportAccountVerification {
  readonly secretRef: string | null;
  readonly secretVersion: string | null;
  readonly state: 'verified' | 'notrequired';
  readonly code: string;
  readonly checkedAt: string;
}

export interface SupportAccountVerifier {
  verify(input: Readonly<{
    provider: SupportAccountProvider;
    scope: string;
    secretRef: string | null;
  }>, execution: ExecutionContext<'support.accounts.manage'>): Promise<SupportAccountVerification>;
}
