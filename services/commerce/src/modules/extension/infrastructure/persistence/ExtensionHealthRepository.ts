import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { PgExtensionRepository } from './PgExtensionRepository';

export function extensionHealthRepository(): PgExtensionRepository {
  return new PgExtensionRepository(new PgTransactionAccess());
}
