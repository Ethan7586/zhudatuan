import type { Operation } from '@shop/contract';
import type { PreauthSecurityContext } from './OperationSecurityContext';

export interface PreauthResolver {
  resolve(headers: Readonly<Record<string, string>>, operation: Operation): Promise<PreauthSecurityContext>;
}
