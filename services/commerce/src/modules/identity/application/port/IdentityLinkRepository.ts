import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { IdentityLink } from '../../domain/model/IdentityLink';
export interface IdentityLinkRepository {
  list(database: OperationDatabase, principal: string): Promise<readonly IdentityLink[]>;
  create(database: OperationDatabase, input: Readonly<{ principal: string; membership: string; provider: string; subjecthash: Buffer; ciphertext: string; keyversion: string }>): Promise<IdentityLink>;
  revoke(database: OperationDatabase, principal: string, link: string): Promise<void>;
}
