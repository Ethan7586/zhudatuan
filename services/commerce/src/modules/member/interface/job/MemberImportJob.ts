import { BatchImportProcessor } from '../../../../foundation/application/BatchImport';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { IdentityPrincipal } from '../../../identity/public/index';
import type { MemberImportAccessPort } from '../../../access/public/index';
import { PgMemberImport } from '../../infrastructure/persistence/PgMemberImport';

export class MemberImportProcessor extends BatchImportProcessor {
  constructor(pool: DatabasePool, objects: ObjectStore, identities: IdentityPrincipal, access: MemberImportAccessPort) {
    super('memberimport', 'member', objects, new PgMemberImport(pool, identities, access));
  }
}
