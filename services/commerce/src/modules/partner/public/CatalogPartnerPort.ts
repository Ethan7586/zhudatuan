import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CatalogPartnerPort {
  scope(database: OperationDatabase, partner: string): Promise<string | null>;
}

export const CATALOG_PARTNER_PORT = publicPort<CatalogPartnerPort>('partner', 'catalog');

export class PgCatalogPartnerPort implements CatalogPartnerPort {
  async scope(database: OperationDatabase, partner: string): Promise<string | null> {
    const result = await database.query<{ scope_id: string }>(`select scope_id from partner.partner where id=$1 and status='active'`, [partner]);
    return result.rows[0]?.scope_id ?? null;
  }
}
