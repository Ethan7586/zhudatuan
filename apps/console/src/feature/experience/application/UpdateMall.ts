import { OP_ORGANIZATION_MALLS_UPDATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { MallUpdateDraft } from '../model/Mall';
import type { MallPort } from '../public';

export class UpdateMall {
  constructor(private readonly malls: MallPort) {}
  execute(context: ConsoleContext, mall: string, version: number, draft: MallUpdateDraft, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_MALLS_UPDATE);
    return this.malls.update(context, mall, version, draft, identity, signal);
  }
}
