import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AuditPort } from '../../../audit/public';
import type { CatalogPartnerPort } from '../../../partner/public';
import type { CatalogQualificationPort } from '../../../qualification/public';
import type { ImportCandidate, ImportTarget } from '../../../runtime/public';
import type { CatalogImportRepository } from '../../application/port/CatalogImportRepository';
import { importProduct } from './ProductImportRow';
import { prepareProducts } from './ProductImportPreflight';
export class PgCatalogImportRepository implements CatalogImportRepository {
  constructor(
    private readonly partners: CatalogPartnerPort,
    private readonly qualifications: CatalogQualificationPort,
    private readonly audit: AuditPort,
    private readonly transactions = new PgTransactionAccess()
  ) {}
  prepare(context: ReadTransactionContext, scope: string, rows: readonly ImportCandidate[]) {
    return prepareProducts(this.transactions.database(context), context, scope, rows, this.partners, this.qualifications);
  }
  async import(context: WriteTransactionContext, target: ImportTarget, row: number, value: Readonly<Record<string, string>>): Promise<void> {
    await importProduct(this.transactions.database(context), context, target, row, value, this.partners, this.audit);
  }
  async release(context: WriteTransactionContext, importId: string, scope: string): Promise<void> {
    await this.transactions.database(context).query('delete from catalog.import_receipts where import_id=$1 and scope_id=$2', [importId, scope]);
  }
}
