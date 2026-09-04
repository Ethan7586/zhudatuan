import type { InvitationOutcome, InvitationResolution } from '../model/Invitation';

export interface InvitationPort {
  resolve(input: InvitationResolution): Promise<InvitationOutcome>;
}
