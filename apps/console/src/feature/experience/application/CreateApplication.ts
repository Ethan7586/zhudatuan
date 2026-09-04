import { OP_ORGANIZATION_MALLS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { MallCreateDraft } from '../model/Mall';
import type { MallPort } from '../public';

export class CreateApplication {
  constructor(private readonly malls: MallPort) {}
  execute(context: ConsoleContext, draft: MallCreateDraft, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_MALLS_CREATE);
    return this.malls.create(context, draft, identity, signal);
  }
}
