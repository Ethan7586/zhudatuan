import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReferralSection } from '../model/Referral';
import type { ReferralPort } from '../public';

export class ReadReferral {
  constructor(private readonly port: Pick<ReferralPort, 'read'>) {}
  execute(context: ConsoleContext, section: ReferralSection, cursor: string | undefined, signal?: AbortSignal) {
    return this.port.read(context, section, cursor, signal);
  }
}
