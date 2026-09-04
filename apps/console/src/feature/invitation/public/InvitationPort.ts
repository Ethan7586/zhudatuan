import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Invitation, InvitationFilter, InvitationMembershipPage, InvitationPage, InvitationReceipt, InvitationRevocation } from '../model/Invitation';
import type { InvitationDraft } from '../model/InvitationDraft';

export interface InvitationPort {
  read(context: ConsoleContext, filter: InvitationFilter, signal?: AbortSignal): Promise<InvitationPage>;
  memberships(context: ConsoleContext, signal?: AbortSignal): Promise<InvitationMembershipPage>;
  create(context: ConsoleContext, draft: InvitationDraft, identity: string, signal?: AbortSignal): Promise<InvitationReceipt>;
  revoke(context: ConsoleContext, invitation: Pick<Invitation, 'id' | 'version'>, reason: string, identity: string, signal?: AbortSignal): Promise<InvitationRevocation>;
}
