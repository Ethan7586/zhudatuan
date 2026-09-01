import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface CapabilityReadinessPort {
  operationCount(context: ReadTransactionContext): Promise<number>;
}

export const CAPABILITY_READINESS_PORT = publicPort<CapabilityReadinessPort>('capability', 'readiness');
