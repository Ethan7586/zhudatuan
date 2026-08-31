import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations } from '../../../../foundation/application/ModuleOperations';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { assignTicketOperations } from '../../application/command/AssignTicket';
import { closeTicketOperations } from '../../application/command/CloseTicket';
import { openConversationOperations } from '../../application/command/OpenConversation';
import { sendMessageOperations } from '../../application/command/SendMessage';
import { getConversationsOperations } from '../../application/query/GetConversations';
import { getTicketsOperations } from '../../application/query/GetTickets';
import { PgSupportRepository } from '../../infrastructure/persistence/PgSupportRepository';
import { SUPPORT_ORDER_PORT } from '../../../order/public/index';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { MEMBER_ACCESS_PORT } from '../../../access/public';
import { SUPPORT_BENEFIT_PORT } from '../../../benefit/public';

export function supportRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const kms = context.service(KMS_CLIENT);
  const objects = context.service(OBJECT_STORE);
  const orders = context.ports.get(SUPPORT_ORDER_PORT);
  const organizations = context.ports.get(ORGANIZATION_READ_PORT);
  const members = context.ports.get(MEMBER_ACCESS_PORT);
  const benefits = context.ports.get(SUPPORT_BENEFIT_PORT);
  const ports = (database: ConstructorParameters<typeof PgSupportRepository>[0]) => new PgSupportRepository(database, orders, organizations, members, benefits);
  return new ModuleOperations('support', pool, context.service(AUDIT_SINK), {
    ...openConversationOperations(kms, ports),
    ...sendMessageOperations(kms, objects, ports),
    ...assignTicketOperations(ports),
    ...closeTicketOperations(ports),
    ...getConversationsOperations(kms, ports),
    ...getTicketsOperations(ports),
  });
}
