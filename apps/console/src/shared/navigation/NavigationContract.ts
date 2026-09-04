import { operationSchema, type OperationOutputFor } from '@shop/contract';
import { OP_NAVIGATION_TREE_READ } from '@shop/contract/ids';

export const NavigationTreeSchema = operationSchema(OP_NAVIGATION_TREE_READ).output;
export type NavigationTree = OperationOutputFor<typeof OP_NAVIGATION_TREE_READ>;
export type NavigationNode = NavigationTree['nodes'][number];
