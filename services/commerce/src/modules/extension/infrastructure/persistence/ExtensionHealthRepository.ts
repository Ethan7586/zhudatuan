import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgExtensionRepository } from './PgExtensionRepository';

export function extensionHealthRepository(): PgExtensionRepository {
  return new PgExtensionRepository(new PgTransactionAccess());
}
