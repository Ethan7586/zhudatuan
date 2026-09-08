import { operationSchema } from '@shop/contract';
import { OP_REPORTING_EXPORTS_READ, OP_REPORTING_DIMENSIONS_READ, OP_REPORTING_PRODUCTS_READ } from '@shop/contract/ids';

export const ReportMetricPageSchema = operationSchema(OP_REPORTING_PRODUCTS_READ).output;
export const ReportPageSchema = ReportMetricPageSchema;
export const ReportExportSchema = operationSchema(OP_REPORTING_EXPORTS_READ).output;
export const ReportDimensionsSchema = operationSchema(OP_REPORTING_DIMENSIONS_READ).output;
