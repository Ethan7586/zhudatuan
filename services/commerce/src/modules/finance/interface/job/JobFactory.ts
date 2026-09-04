import { PgTransactionManager } from '../../../../adapter/database/PgTransactionManager';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import type { ModuleJob } from '../../../../foundation/application/ModuleJob';
import { KMS_CLIENT } from '../../../../foundation/application/KmsPort';
import { OBJECT_STORE } from '../../../runtime/public/ObjectPort';
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
import { PgInvoiceProcess } from '../../infrastructure/persistence/PgInvoiceProcess';
import { PgReconciliationProcess } from '../../infrastructure/persistence/PgReconciliationProcess';
import { PgSettlementProcess } from '../../infrastructure/persistence/PgSettlementProcess';
import { PROVIDER_FINANCE_PORT } from '../../public';
import { ReconciliationJob } from './ReconciliationJob';
import { InvoiceJob } from './InvoiceJob';
import { SettlementJob } from './SettlementJob';
import { IMPORT_BATCH_FACTORY_PORT, IMPORT_RUNNER_PORT, JOB_PORT, RUNTIME_IMPORT_PORT, TABULAR_FILE_PORT } from '../../../runtime/public';
import { FinanceImportProcess } from '../../application/process/FinanceImportProcess';
import { PgStatementImportProcess } from '../../infrastructure/persistence/PgStatementImportProcess';
import { StatementImportJob } from './StatementImportJob';
import { TASK_AUTHORIZATION_PORT } from '../../../access/public';
import { APPROVAL_PORT } from '../../../approval/public';
import { FINANCE_ORDER_PORT } from '../../../order/public';
import { PgReconciliationReview } from '../../infrastructure/persistence/PgReconciliationReview';

export function createJobs(context: ModuleContext): readonly ModuleJob[] {
  const pool = context.service(DATABASE_POOL);
  const transactions = new PgTransactionManager(pool);
  const deadletter = new FinanceDeadletter();
  return Object.freeze([
    {
      id: 'financeimport',
      processor: new StatementImportJob(
        new FinanceImportProcess(
          context.ports.get(IMPORT_RUNNER_PORT),
          new PgStatementImportProcess(context.ports.get(IMPORT_BATCH_FACTORY_PORT), transactions, context.ports.get(RUNTIME_IMPORT_PORT), context.ports.get(JOB_PORT), context.ports.get(TASK_AUTHORIZATION_PORT))
        )
      ),
      deadletter,
    },
    {
      id: 'reconciliation',
      processor: new ReconciliationJob(
        new ReconcileFinance(
          new PgReconciliationProcess(transactions, context.ports.get(TABULAR_FILE_PORT), {
            channel: context.ports.get(FINANCE_CHANNEL_PORT),
            fulfillments: context.ports.get(FINANCE_FULFILLMENT_PORT),
            payments: context.ports.get(FINANCE_PAYMENT_PORT),
          }),
          new PgReconciliationReview(transactions, context.ports.get(APPROVAL_PORT))
        )
      ),
      deadletter,
    },
    { id: 'settlement', processor: new SettlementJob(new RunSettlement(new PgSettlementProcess(transactions, context.service(PAYOUT_GATEWAY), context.ports.get(FINANCE_PAYMENT_PORT), context.ports.get(FINANCE_ORDER_PORT)))), deadletter },
    {
      id: 'invoice',
      processor: new InvoiceJob(new IssueInvoice(new PgInvoiceProcess(transactions, context.service(OBJECT_STORE), context.service(KMS_CLIENT), context.service(INVOICE_ISSUER)))),
      deadletter,
    },
  ]);
}

export function createProviderJobs(context: ModuleContext): readonly ModuleJob[] {
  const channel = context.ports.get(PROVIDER_SYNC_PORT).statement(context.ports.get(PROVIDER_FINANCE_PORT));
  return Object.freeze([{ id: 'statementsync', processor: channel, deadletter: channel }]);
}
