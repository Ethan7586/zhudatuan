import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReferralPage, ReferralSection } from '../model/Referral';
import type { ReferralCommand } from '../model/ReferralOperation';

export interface ReferralPort {
  read(context: ConsoleContext, section: ReferralSection, cursor?: string, signal?: AbortSignal): Promise<ReferralPage>;
  execute(context: ConsoleContext, command: ReferralCommand, proof: string, identity: string, signal?: AbortSignal): Promise<void>;
}
