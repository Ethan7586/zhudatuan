import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { Cache } from '../../../../foundation/cache/Cache';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { metricOperation } from './GetDashboard';
import type { ReportingFactory } from '../../01_public_gongkai/ReportingPort';

export function getSalesReportOperations(factory: ReportingFactory<OperationDatabase>, pool: DatabasePool, cache: Cache): OperationActions {
  return {
    'reporting.sales.read': metricOperation(factory, pool, cache, 'sales'),
    'reporting.products.read': metricOperation(factory, pool, cache, 'product'),
    'reporting.malls.read': metricOperation(factory, pool, cache, 'mall'),
    'reporting.categories.read': metricOperation(factory, pool, cache, 'category'),
    'reporting.channels.read': metricOperation(factory, pool, cache, 'channel'),
    'reporting.powderclass.read': metricOperation(factory, pool, cache, 'powderclass'),
    'reporting.voucherconsumption.read': metricOperation(factory, pool, cache, 'voucher'),
  };
}
