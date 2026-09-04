import { operationSchema } from '@shop/contract';
import {
  OP_REPORTING_EXPORTS_READ,
  OP_REPORTING_PRODUCTS_READ,
  OP_REPORTING_SALES_READ,
} from '@shop/contract/ids';

export const ReportPageSchema = operationSchema(OP_REPORTING_SALES_READ).output;
export const ReportMetricPageSchema = operationSchema(OP_REPORTING_PRODUCTS_READ).output;
export const ReportExportSchema = operationSchema(OP_REPORTING_EXPORTS_READ).output;
