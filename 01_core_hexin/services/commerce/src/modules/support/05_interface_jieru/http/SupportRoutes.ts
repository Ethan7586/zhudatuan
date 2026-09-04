import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { assignTicketOperations } from '../../03_application_yingyong/command/AssignTicket';
import { closeTicketOperations } from '../../03_application_yingyong/command/CloseTicket';
import { openConversationOperations } from '../../03_application_yingyong/command/OpenConversation';
import { sendMessageOperations } from '../../03_application_yingyong/command/SendMessage';
import { getConversationsOperations } from '../../03_application_yingyong/query/GetConversations';
import { getTicketsOperations } from '../../03_application_yingyong/query/GetTickets';
import { PgSupportRepository } from '../../04_adapters_shixian/persistence/PgSupportRepository';
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
