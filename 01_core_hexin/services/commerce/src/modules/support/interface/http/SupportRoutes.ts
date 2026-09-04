import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { assignTicketOperations } from '../../application/command/AssignTicket';
import { closeTicketOperations } from '../../application/command/CloseTicket';
import { openConversationOperations } from '../../application/command/OpenConversation';
import { sendMessageOperations } from '../../application/command/SendMessage';
import { getConversationsOperations } from '../../application/query/GetConversations';
import { getTicketsOperations } from '../../application/query/GetTickets';
import { PgSupportRepository } from '../../infrastructure/persistence/PgSupportRepository';
import { GetOrderSummary } from '../../../order_dingdan';

export function supportRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL); const kms = context.container.get(KMS_CLIENT);
  const orders = new GetOrderSummary();
  const ports = (database: ConstructorParameters<typeof PgSupportRepository>[0]) => new PgSupportRepository(database, orders);
  return new ModuleOperations('support', pool, context.container.get(AUDIT_SINK), {
    ...openConversationOperations(kms, ports), ...sendMessageOperations(kms, ports), ...assignTicketOperations(ports),
    ...closeTicketOperations(ports), ...getConversationsOperations(kms, ports), ...getTicketsOperations(ports),
  });
}
