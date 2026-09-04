import { OP_CATALOG_IMPORTS_READ, OP_MEMBER_IMPORTS_READ, OP_VOUCHER_IMPORTS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { ImportKind } from '../model/ImportTask';
import type { TaskPort } from '../public';

export class ReadImportTask {
  constructor(private readonly port: Pick<TaskPort, 'read'>) {}
  execute(context: ConsoleContext, kind: ImportKind, id: string, signal?: AbortSignal) {
    const operation = kind === 'member' ? OP_MEMBER_IMPORTS_READ : kind === 'catalog' ? OP_CATALOG_IMPORTS_READ : OP_VOUCHER_IMPORTS_READ;
    assertOperationAccess(context, operation);
    if (!id) throw new Error('IMPORT_TASK_REQUIRED');
    return this.port.read(context, kind, id, signal);
  }
}
