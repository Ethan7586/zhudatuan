import { operationSchema } from '@shop/contract';
import { OP_REPORTING_DASHBOARD_READ } from '@shop/contract/ids';

export const CockpitSchema = operationSchema(OP_REPORTING_DASHBOARD_READ).output;
