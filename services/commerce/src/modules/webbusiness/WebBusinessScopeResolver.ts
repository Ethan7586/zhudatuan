import type { Scope } from '@shop/authz';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { Actor } from '../../foundation/security/AccessContext';
import { PgScopeResolver } from '../../foundation/security/PgAccessResolvers';
import type { ScopeResolver } from '../../foundation/security/ScopeResolver';

const MEMBER_OWNED_OPERATIONS = new Set([
  'member.profile.read',
  'member.addresses.read',
  'member.addresses.manage',
]);

const STOREFRONT_MALL_OPERATIONS = new Set([
  'catalog.listings.read',
  'pricing.offers.read',
  'inventory.availability.read',
]);

export class WebBusinessScopeResolver implements ScopeResolver {
  private readonly canonical: PgScopeResolver;

  constructor(private readonly pool: DatabasePool) {
    this.canonical = new PgScopeResolver(pool);
  }

  async resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope> {
    if (MEMBER_OWNED_OPERATIONS.has(operation)) {
      return this.sessionScope(actor, 'access.web_member_scope($1,$2)', 'owner');
    }
    if (actor.target === 'storefront' && STOREFRONT_MALL_OPERATIONS.has(operation)) {
      return this.sessionScope(actor, 'access.web_storefront_scope($1,$2)', 'mall');
    }
    return this.canonical.resolve(actor, operation, resource, scopeHint);
  }

  private async sessionScope(actor: Actor, expression: string, kind: Scope['kind']): Promise<Scope> {
    const result = await this.pool.query<{ scope: Scope }>(`select ${expression} scope`, [actor.membership, actor.session]);
    const row = result.rows[0];
    if (!row?.scope || row.scope.kind !== kind) throw new Error('SCOPE_DENIED');
    return row.scope;
  }
}
