import type { IdentityPrincipal } from '../application/port/IdentityPrincipal';

export class PgIdentityPrincipal implements IdentityPrincipal {
  async ensurePending(database: Parameters<IdentityPrincipal['ensurePending']>[0], principal: string): Promise<void> {
    await database.query('select identity.ensure_imported_principal($1)', [principal]);
  }
}
