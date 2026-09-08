import type { TransactionManager } from '../../../../platform/database/TransactionManager';
import type { MemberAccessPort, MemberImportAccessPort, TaskAuthorizationPort } from '../../../access/public';
import type { IdentityPrincipal } from '../../../identity/public';
import type { ImportBatchFactoryPort, ImportPort, JobPort } from '../../../runtime/public';
import type { ImportProcessPort } from '../../application/port/ImportProcessPort';
import { importMember } from '../../application/service/MemberProfileImport';
import { MemberPort } from './MemberPort';

export function createImportProcess(
  factory: ImportBatchFactoryPort,
  manager: TransactionManager,
  runtime: ImportPort,
  jobs: JobPort,
  identities: IdentityPrincipal,
  access: MemberImportAccessPort,
  profiles: Pick<MemberAccessPort, 'syncProfile'>,
  authorization: TaskAuthorizationPort
): ImportProcessPort {
  const members = new MemberPort(profiles);
  return factory.create({
    owner: 'member',
    failure: 'MEMBER_IMPORT_ROW_FAILED',
    transactions: manager,
    runtime,
    authorization,
    write: (context, target, _row, value) => importMember(context, identities, access, members, target.scope, value),
    continue: (context, target, sequence) =>
      jobs
        .create(context, {
          idempotency: `${target.id}:${sequence}`,
          kind: 'memberimport',
          owner: 'member',
          scope: target.scope,
          queue: 'import',
          payload: Object.freeze({ import: target.id }),
          actor: 'system:member',
        })
        .then(() => undefined),
  });
}
