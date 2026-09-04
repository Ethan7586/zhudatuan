import { OP_RUNTIME_UPLOADS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { ImportDraft } from '../model/ImportDraft';
import type { Task } from '../model/Task';
import type { TaskPort } from '../public';
import type { ImportRegistryPort } from '../../../app/registry/ImportRegistry';

export class CreateImport {
  constructor(private readonly port: Pick<TaskPort, 'createImport'>, private readonly registry: ImportRegistryPort) {}

  execute(context: ConsoleContext, draft: ImportDraft, identity: string, signal?: AbortSignal): Promise<Task> {
    assertOperationAccess(context, OP_RUNTIME_UPLOADS_CREATE);
    assertOperationAccess(context, this.registry.get(draft.kind).operation);
    if (!draft.file || !draft.confirmed || !identity) throw new Error('VALIDATION_FAILED');
    return this.port.createImport(context, draft, identity, signal);
  }
}
