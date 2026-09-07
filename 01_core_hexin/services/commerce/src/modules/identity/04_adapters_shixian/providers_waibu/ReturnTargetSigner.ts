import { createHmac } from 'node:crypto';
import type { AuthReturnTargets, AuthTarget } from '@shop/config/server';

export interface SignedReturnTarget { readonly url: string; readonly proof: string; readonly expiresAt: string }

export class ReturnTargetSigner {
  constructor(private readonly targets: AuthReturnTargets, private readonly key: string) {}

  issue(target: AuthTarget, originOrNow: string | Date = this.targets[target], at = new Date()): SignedReturnTarget {
    const url = typeof originOrNow === 'string' ? originOrNow : this.targets[target];
    const now = originOrNow instanceof Date ? originOrNow : at;
    const expiresAt = new Date(now.getTime() + 60_000).toISOString();
    const payload = Buffer.from(JSON.stringify({ version: 1, target, url, expiresAt })).toString('base64url');
    const signature = createHmac('sha256', this.key).update(payload).digest('base64url');
    return Object.freeze({ url, proof: `${payload}.${signature}`, expiresAt });
  }
}
