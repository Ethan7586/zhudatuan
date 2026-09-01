import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { FINANCE_CHANNEL_PORT, PROVIDER_SYNC_PORT } from '../../../channel/public';
import { FINANCE_FULFILLMENT_PORT } from '../../../fulfillment/public';
import { FINANCE_PAYMENT_PORT } from '../../../payment/public';
import { INVOICE_ISSUER } from '../../application/port/InvoiceIssuer';
import { PAYOUT_GATEWAY } from '../../application/port/PayoutGateway';
import { IssueInvoice } from '../../application/process/IssueInvoice';
import { ReconcileFinance } from '../../application/process/ReconcileFinance';
import { RunSettlement } from '../../application/process/RunSettlement';
import { FinanceDeadletter } from '../../infrastructure/persistence/FinanceDeadletter';
import { FinancePort } from '../../infrastructure/persistence/FinancePort';
import { PgInvoiceProcess } from '../../infrastructure/persistence/PgInvoiceProcess';
import { PgReconciliationProcess } from '../../infrastructure/persistence/PgReconciliationProcess';
import { PgSettlementProcess } from '../../infrastructure/persistence/PgSettlementProcess';
import { PROVIDER_FINANCE_PORT } from '../../public';
import { ReconciliationJob } from './ReconciliationJob';
import { InvoiceJob } from './InvoiceJob';
import { SettlementJob } from './SettlementJob';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const deadletter = new FinanceDeadletter();
  return Object.freeze([
    {
      id: 'reconciliation',
      processor: new ReconciliationJob(
        new ReconcileFinance(
          new PgReconciliationProcess(transactions, context.service(OBJECT_STORE), {
            channel: context.ports.get(FINANCE_CHANNEL_PORT),
            fulfillments: context.ports.get(FINANCE_FULFILLMENT_PORT),
            payments: context.ports.get(FINANCE_PAYMENT_PORT),
          })
        )
      ),
      deadletter,
    },
    { id: 'settlement', processor: new SettlementJob(new RunSettlement(new PgSettlementProcess(transactions, context.service(PAYOUT_GATEWAY)))), deadletter },
    {
      id: 'invoice',
      processor: new InvoiceJob(new IssueInvoice(new PgInvoiceProcess(transactions, context.service(OBJECT_STORE), context.service(KMS_CLIENT), context.service(INVOICE_ISSUER)))),
      deadletter,
    },
  ]);
}

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  return Object.freeze([{ id: 'statementsync', processor: context.ports.get(PROVIDER_SYNC_PORT).statement(context.ports.get(PROVIDER_FINANCE_PORT)) }]);
}
