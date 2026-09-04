import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { RuntimeCleanupPorts } from '../../application/port/CleanupPort';
import { PgControlCleanup } from './PgControlCleanup';
import { PgExportCleanup } from './PgExportCleanup';
import { PgImportCleanup } from './PgImportCleanup';
import { PgInboxCleanup } from './PgInboxCleanup';
import { PgJobCleanup } from './PgJobCleanup';
import { PgOutboxCleanup } from './PgOutboxCleanup';

/** Composition-only factory; each retention stream remains an independently replaceable adapter. */
export function createCleanupRepositories(transactions = new PgTransactionAccess()): RuntimeCleanupPorts {
  return Object.freeze({
    jobs: new PgJobCleanup(transactions),
    imports: new PgImportCleanup(transactions),
    exports: new PgExportCleanup(transactions),
    control: new PgControlCleanup(transactions),
    inbox: new PgInboxCleanup(transactions),
    outbox: new PgOutboxCleanup(transactions),
  });
}
