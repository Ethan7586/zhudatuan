import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { VoucherPort } from './infrastructure/persistence/VoucherPort';
import { VOUCHER_ACCOUNTING_PORT } from '../finance/public/index';
import { CHECKOUT_VOUCHER_PORT, PAYMENT_VOUCHER_PORT, VERIFICATION_VOUCHER_PORT } from './public/index';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { PgVoucherRepository } from './infrastructure/persistence/PgVoucherRepository';
import { CardLibrariesAllocateHandler } from './application/handler/CardLibrariesAllocateHandler';
import { CardLibrariesCreateHandler } from './application/handler/CardLibrariesCreateHandler';
import { CardLibrariesReadHandler } from './application/handler/CardLibrariesReadHandler';
import { ImportsReadHandler } from './application/handler/ImportsReadHandler';
import { ProgramsManageHandler } from './application/handler/ProgramsManageHandler';
import { ProgramsReadHandler } from './application/handler/ProgramsReadHandler';
import { ReservesDecideHandler } from './application/handler/ReservesDecideHandler';
import { ReservesReadHandler } from './application/handler/ReservesReadHandler';
import { ReservesRequestHandler } from './application/handler/ReservesRequestHandler';
import { BatchesIssueHandler } from './application/handler/BatchesIssueHandler';
import { BatchesReadHandler } from './application/handler/BatchesReadHandler';
import { BatchesRetryHandler } from './application/handler/BatchesRetryHandler';
import { StatusBatchHandler } from './application/handler/StatusBatchHandler';
import { StatusBatchesReadHandler } from './application/handler/StatusBatchesReadHandler';
import { BindingsManageHandler } from './application/handler/BindingsManageHandler';
import { BindingsReadHandler } from './application/handler/BindingsReadHandler';
import { HistoryReadHandler } from './application/handler/HistoryReadHandler';
import { RedemptionsReadHandler } from './application/handler/RedemptionsReadHandler';
import { RedemptionsReverseHandler } from './application/handler/RedemptionsReverseHandler';
import { createJobs } from './interface/job/JobFactory';

export const VoucherModule = defineModule(Manifest, {
  jobs: createJobs,
  handlers: (context) => {
    const repository = new PgVoucherRepository(new PgTransactionAccess(), context);
    return [
      new CardLibrariesReadHandler(repository),
      new CardLibrariesCreateHandler(repository),
      new CardLibrariesAllocateHandler(repository),
      new ImportsReadHandler(repository),
      new ProgramsReadHandler(repository),
      new ProgramsManageHandler(repository),
      new ReservesReadHandler(repository),
      new ReservesRequestHandler(repository),
      new ReservesDecideHandler(repository),
      new BatchesReadHandler(repository),
      new BatchesIssueHandler(repository),
      new BatchesRetryHandler(repository),
      new StatusBatchHandler(repository),
      new StatusBatchesReadHandler(repository),
      new BindingsReadHandler(repository),
      new BindingsManageHandler(repository),
      new RedemptionsReadHandler(repository),
      new HistoryReadHandler(repository),
      new RedemptionsReverseHandler(repository),
    ];
  },
  ports: (context) => {
    const checkout = new VoucherPort();
    return [
      { token: CHECKOUT_VOUCHER_PORT, value: checkout },
      { token: VERIFICATION_VOUCHER_PORT, value: checkout },
      { token: PAYMENT_VOUCHER_PORT, value: new VoucherPort(context.ports.get(VOUCHER_ACCOUNTING_PORT)) },
    ];
  },
  jobPorts: (context) => [{ token: PAYMENT_VOUCHER_PORT, value: new VoucherPort(context.ports.get(VOUCHER_ACCOUNTING_PORT)) }],
});
