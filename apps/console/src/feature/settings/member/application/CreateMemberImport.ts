import { OP_MEMBER_IMPORTS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { MemberImportSource } from '../model/Member';
import type { MemberPort } from '../public';

export class CreateMemberImport {
  constructor(private readonly port: Pick<MemberPort, 'createImport'>) {}
  execute(context: ConsoleContext, source: MemberImportSource, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_MEMBER_IMPORTS_CREATE);
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    if (!(source.file instanceof File) || source.file.size < 1) throw new Error('VALIDATION_FAILED');
    return this.port.createImport(context, source, identity, signal);
  }
}
