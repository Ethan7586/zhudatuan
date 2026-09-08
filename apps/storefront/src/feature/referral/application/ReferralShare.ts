import { hasFailureCode } from '@shop/presentation';
import type { StorefrontSession } from '../../../entity/session';
import { storefrontUrl } from '../../../shared/navigation/StorefrontUrl';
import type { ReferralPort } from '../public/ReferralPort';

export class ReferralShare {
  constructor(private readonly gateway: Pick<ReferralPort, 'link'>) {}
  async execute(session: StorefrontSession | null, productId: string, path: string): Promise<Readonly<{ url: string; attributed: boolean }>> {
    if (!session) return Object.freeze({ url: storefrontUrl(path), attributed: false });
    try {
      const link = await this.gateway.link(session, productId);
      return Object.freeze({ url: storefrontUrl(path, { referral: link.token }), attributed: true });
    } catch (cause) {
      if (!hasFailureCode(cause, 'REFERRAL_NOT_ELIGIBLE')) throw cause;
      return Object.freeze({ url: storefrontUrl(path), attributed: false });
    }
  }
}
