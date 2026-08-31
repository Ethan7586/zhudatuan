import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { Cache } from '../../../../foundation/cache/Cache';
import { metricOperation } from './GetDashboard';
import type { ReportingFactory } from '../port/ReportingPort';

export function getSalesReportOperations(factory: ReportingFactory<OperationDatabase>, cache: Cache): OperationActions {
  return {
    'reporting.sales.read': metricOperation(factory, cache, 'sales'),
    'reporting.products.read': metricOperation(factory, cache, 'product'),
    'reporting.malls.read': metricOperation(factory, cache, 'mall'),
    'reporting.categories.read': metricOperation(factory, cache, 'category'),
    'reporting.channels.read': metricOperation(factory, cache, 'channel'),
    'reporting.powderclass.read': metricOperation(factory, cache, 'powderclass'),
    'reporting.voucherconsumption.read': metricOperation(factory, cache, 'voucher'),
  };
}
