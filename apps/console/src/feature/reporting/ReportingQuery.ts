import {
  createFetchReportingCategoriesRead,
  createFetchReportingChannelsRead,
  createFetchReportingMallsRead,
  createFetchReportingPowderclassRead,
  createFetchReportingProductsRead,
  createFetchReportingSalesRead,
  createFetchReportingVoucherconsumptionRead,
} from '@shop/sdk/reporting';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ReportPageSchema, type ReportPeriod, type ReportView } from './ReportingSchema';

const salesRead = createFetchReportingSalesRead(appConfig.apiBaseUrl);
const productsRead = createFetchReportingProductsRead(appConfig.apiBaseUrl);
const mallsRead = createFetchReportingMallsRead(appConfig.apiBaseUrl);
const categoriesRead = createFetchReportingCategoriesRead(appConfig.apiBaseUrl);
const channelsRead = createFetchReportingChannelsRead(appConfig.apiBaseUrl);
const powderclassRead = createFetchReportingPowderclassRead(appConfig.apiBaseUrl);
const voucherconsumptionRead = createFetchReportingVoucherconsumptionRead(appConfig.apiBaseUrl);

export const reportViews = ['sales', 'products', 'malls', 'categories', 'channels', 'powderclass', 'voucher'] as const;
export const reportPeriods = ['realtime', 'yesterday', '7days', '30days'] as const;
export const reportKey = (context: ConsoleContext, view: ReportView, period: ReportPeriod, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, reportOperation(view), period, cursor ?? null, 50] as const);

export async function readReport(context: ConsoleContext, view: ReportView, period: ReportPeriod, cursor: string | undefined, signal: AbortSignal) {
  const input = { query: { limit: 50, period, ...(cursor === undefined ? {} : { cursor }) } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  const value =
    view === 'sales'
      ? await salesRead(input, request)
      : view === 'products'
        ? await productsRead(input, request)
        : view === 'malls'
          ? await mallsRead(input, request)
          : view === 'categories'
            ? await categoriesRead(input, request)
            : view === 'channels'
              ? await channelsRead(input, request)
              : view === 'powderclass'
                ? await powderclassRead(input, request)
                : await voucherconsumptionRead(input, request);
  return ReportPageSchema.parse(value);
}

function reportOperation(view: ReportView): string {
  return view === 'voucher' ? 'reporting.voucherconsumption.read' : `reporting.${view}.read`;
}
