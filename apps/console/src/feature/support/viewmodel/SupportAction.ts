import type { SupportDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Ticket } from '../model/Ticket';

export type TicketAction = Readonly<{ kind: 'close' }> | Readonly<{ kind: 'reopen' }> | Readonly<{ kind: 'assign'; agent: string; reason: string }>;

export async function executeTicketAction(context: ConsoleContext, dependencies: SupportDependencies, ticket: Ticket | undefined, value: TicketAction): Promise<void> {
  if (!ticket) throw new Error('请先选择工单。');
  if (value.kind === 'close') await dependencies.closeTicket.execute(context, ticket);
  else if (value.kind === 'reopen') await dependencies.reopenTicket.execute(context, ticket);
  else await dependencies.assignTicket.execute(context, ticket, value.agent, value.reason);
}
