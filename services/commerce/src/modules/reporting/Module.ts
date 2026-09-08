import { defineModule } from '../../composition/DefinedModule';
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
import { PgTransactionAccess } from '../../platform/database/PgTransactionAccess';
import { JOB_PORT, OBJECT_STORE } from '../runtime/public';
import { CATALOG_DIMENSION_PORT } from '../catalog/public';
import { EXPERIENCE_DIMENSION_PORT } from '../experience/public';
import { MEMBER_READ_PORT } from '../member/public';
import { ORGANIZATION_READ_PORT } from '../organization/public';
import { CATALOG_PARTNER_PORT } from '../partner/public';
import { DimensionReader } from './application/service/DimensionReader';
import { DimensionsReadHandler } from './application/handler/DimensionsReadHandler';

export const ReportingModule = defineModule(Manifest, {
  jobs: createJobs,
  events: [{ handler: 'projection', events: EVENT_SUBSCRIPTIONS.projection }],
  handlers: (context) => {
    const transactions = new PgTransactionAccess();
    const reports = new PgReportRepository(transactions);
    const dimensions = new DimensionReader(
      context.ports.get(ORGANIZATION_READ_PORT),
      context.ports.get(EXPERIENCE_DIMENSION_PORT),
      context.ports.get(CATALOG_DIMENSION_PORT),
      context.ports.get(MEMBER_READ_PORT),
      context.ports.get(CATALOG_PARTNER_PORT)
    );
    const metrics = new MetricReader(reports, dimensions);
    return [
      new DimensionsReadHandler(dimensions),
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
