import type { IdentityPrincipal } from '../application/port/IdentityPrincipal';

export class PgIdentityPrincipal implements IdentityPrincipal {
  async ensurePending(database: Parameters<IdentityPrincipal['ensurePending']>[0], principal: string): Promise<void> {
    await database.query(`insert into identity.principal(id,status,created_at,updated_at)
      values($1,'pending',clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`, [principal]);
  }
}
