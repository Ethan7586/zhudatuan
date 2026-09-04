import { operationSchema } from '@shop/contract';
import { OP_ORGANIZATION_MALLS_READ } from '@shop/contract/ids';

export const MallRecordSchema = operationSchema(OP_ORGANIZATION_MALLS_READ).output;
