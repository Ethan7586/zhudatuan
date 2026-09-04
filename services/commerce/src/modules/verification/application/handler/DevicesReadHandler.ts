import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { DeviceRepository } from '../port/DeviceRepository';

export class DevicesReadHandler implements OperationHandler<'verification.devices.read', 'read'> {
  readonly operation = 'verification.devices.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly devices: DeviceRepository) {}
  async execute(input: OperationInputFor<'verification.devices.read'>, context: HandlerContext<'verification.devices.read'>): Promise<OperationReply<OperationOutputFor<'verification.devices.read'>>> {
    const page = queryPage(input, 200);
    const rows = await this.devices.devices(context.transaction, requireSession(context.security).scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'label') as OperationOutputFor<'verification.devices.read'> };
  }
}
