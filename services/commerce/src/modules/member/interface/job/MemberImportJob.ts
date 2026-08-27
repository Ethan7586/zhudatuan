import { BatchImportProcessor } from '../../../../foundation/application/BatchImport';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { IdentityPrincipal } from '../../../identity/IdentityModule';
import { PgMemberImport } from '../../infrastructure/persistence/PgMemberImport';

export class MemberImportProcessor extends BatchImportProcessor {
  constructor(pool: DatabasePool, objects: ObjectStore, identities: IdentityPrincipal) {
    super('memberimport', 'member', objects, new PgMemberImport(pool, identities));
  }
}
