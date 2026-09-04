import type { PaymentScene } from '../../public';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';

export interface PaymentContinuation {
  continue(request: OperationRequest, input: Readonly<{ order: string; scene: PaymentScene }>): Promise<OperationResult>;
}
