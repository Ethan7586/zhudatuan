import { OP_PARTNER_PARTNERS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { PartnerKind } from '../model/Partner';
import type { PartnerPort } from '../public';

export class ReadPartners {
  constructor(private readonly port: Pick<PartnerPort, 'readPartners'>) {}
  execute(context: ConsoleContext, kind: PartnerKind, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_PARTNER_PARTNERS_READ);
    return this.port.readPartners(context, kind, cursor, signal);
  }
}
