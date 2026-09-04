import { createHash } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { DeviceRepository } from '../port/DeviceRepository';

export class DevicesManageHandler implements OperationHandler<'verification.devices.manage', 'write'> {
  readonly operation = 'verification.devices.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly devices: DeviceRepository) {}
  async execute(input: OperationInputFor<'verification.devices.manage'>, context: WriteHandlerContext<'verification.devices.manage'>): Promise<OperationReply<OperationOutputFor<'verification.devices.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const status = body.status === 'blocked' ? 'blocked' : body.status === 'retired' ? 'retired' : 'trusted';
    const result = await this.devices.manage(context.transaction, {
      id: input.path.deviceid,
      scope: access.scope.id,
      label: textField(body, 'label'),
      fingerprintHash: createHash('sha256')
        .update(textField(body, 'fingerprint', 512))
        .digest('hex'),
      publicKey: typeof body.publicKey === 'string' ? body.publicKey : null,
      status,
      expectedVersion: context.expectedVersion ?? null,
      now: new Date(),
    });
    return { status: 200, body: result as OperationOutputFor<'verification.devices.manage'> };
  }
}
