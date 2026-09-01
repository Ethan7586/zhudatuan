import type { AuthTarget } from '@shop/config/server';
export interface SignedReturnTarget {
  readonly url: string;
  readonly proof: string;
  readonly expiresAt: string;
  readonly target: AuthTarget;
  readonly tenant?: string;
}
export interface ReturnTargetPort {
  issue(target: AuthTarget, options?: Date | Readonly<{ now?: Date; tenant?: string; path?: string }>): SignedReturnTarget;
  verify(proof: string, now?: Date): SignedReturnTarget;
}
