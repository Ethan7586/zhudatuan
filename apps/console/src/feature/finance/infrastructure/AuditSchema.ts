import { operationSchema } from '@shop/contract';
import { OP_FINANCE_AUDIT_READ } from '@shop/contract/ids';

export const FinanceAuditSchema = operationSchema(OP_FINANCE_AUDIT_READ).output;
