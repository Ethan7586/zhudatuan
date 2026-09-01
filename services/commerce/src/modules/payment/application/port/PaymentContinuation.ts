import type { WechatScene } from '@shop/config/server';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';

export interface PaymentContinuation {
  continue(request: OperationRequest, input: Readonly<{ order: string; scene: WechatScene }>): Promise<OperationResult>;
}
