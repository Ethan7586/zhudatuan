import type { IdentityPrincipal } from '../../01_public_gongkai/ports_jiekou/IdentityPrincipal';

export class PgIdentityPrincipal implements IdentityPrincipal {
  async ensurePending(database: Parameters<IdentityPrincipal['ensurePending']>[0], principal: string): Promise<void> {
    await database.query('select identity.ensure_imported_principal($1)', [principal]);
  }
}
