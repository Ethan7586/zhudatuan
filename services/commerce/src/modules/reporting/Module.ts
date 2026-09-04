import { defineModule } from '../../bootstrap/DefinedModule';
import { Manifest } from './Manifest';
import { createJobs } from './interface/job/JobFactory';
import { EVENT_SUBSCRIPTIONS } from '../../generated/EventSubscriptions';
import { DashboardReadHandler } from './application/handler/DashboardReadHandler';
import { SalesReadHandler } from './application/handler/SalesReadHandler';
import { ProductsReadHandler } from './application/handler/ProductsReadHandler';
import { MallsReadHandler } from './application/handler/MallsReadHandler';
import { CategoriesReadHandler } from './application/handler/CategoriesReadHandler';
import { ChannelsReadHandler } from './application/handler/ChannelsReadHandler';
import { VoucherConsumptionReadHandler } from './application/handler/VoucherConsumptionReadHandler';
import { ExportsCreateHandler } from './application/handler/ExportsCreateHandler';
import { ExportsReadHandler } from './application/handler/ExportsReadHandler';
import { PgReportRepository } from './infrastructure/persistence/PgReportRepository';
import { MetricReader } from './application/service/MetricReader';
import { PgTransactionAccess } from '../../adapter/database/PgTransactionAccess';
import { JOB_PORT, OBJECT_STORE } from '../runtime/public';

export const ReportingModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [{ handler: 'projection', events: EVENT_SUBSCRIPTIONS.projection }],
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const reports = new PgReportRepository(transactions);
    const metrics = new MetricReader(reports);
    return [
      new DashboardReadHandler(metrics),
      new SalesReadHandler(metrics),
      new ProductsReadHandler(metrics),
      new MallsReadHandler(metrics),
      new CategoriesReadHandler(metrics),
      new ChannelsReadHandler(metrics),
      new VoucherConsumptionReadHandler(metrics),
      new ExportsCreateHandler(reports, context.ports.get(JOB_PORT)),
      new ExportsReadHandler(reports, context.service(OBJECT_STORE)),
    ];
  },
});
