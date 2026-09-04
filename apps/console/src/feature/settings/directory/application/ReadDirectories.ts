import { OP_ORGANIZATION_DIRECTORIES_READ, OP_ORGANIZATION_DIRECTORIES_SYNCRUNS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { DirectoryPort } from '../public';

export class ReadDirectories {
  constructor(private readonly port: DirectoryPort) {}
  list(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_DIRECTORIES_READ);
    return this.port.read(context, cursor, signal);
  }
  runs(context: ConsoleContext, directory: string, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_DIRECTORIES_SYNCRUNS_READ);
    return this.port.runs(context, directory, cursor, signal);
  }
}
