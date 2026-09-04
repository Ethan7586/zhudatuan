import { OP_ORGANIZATION_STORES_MANAGE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { StoreChange } from '../model/Store';
import type { PartnerPort } from '../public';
import { requireCommand } from './ManagePartner';

export class ManageStore {
  constructor(private readonly port: Pick<PartnerPort, 'manageStore'>) {}
  execute(context: ConsoleContext, change: StoreChange, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_STORES_MANAGE);
    requireCommand(context, identity, change.name);
    if (!/^[A-Za-z0-9.-]{2,32}$/.test(change.regionCode) || (change.serviceRadiusMeters !== null && (!Number.isInteger(change.serviceRadiusMeters) || change.serviceRadiusMeters < 1 || change.serviceRadiusMeters > 1_000_000)))
      throw new Error('VALIDATION_FAILED');
    return this.port.manageStore(context, change, identity, signal);
  }
}
