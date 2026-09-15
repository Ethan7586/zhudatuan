import type { Scope } from '@shop/authz';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { Actor } from '../../foundation/security/AccessContext';
import { PgScopeResolver } from '../../foundation/security/PgAccessResolvers';
import type { ScopeResolver } from '../../foundation/security/ScopeResolver';

export class WebBusinessScopeResolver implements ScopeResolver {
  private readonly canonical: PgScopeResolver;

  constructor(pool: DatabasePool) {
    this.canonical = new PgScopeResolver(pool);
  }

  async resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope> {
    return this.canonical.resolve(actor, operation, resource, scopeHint);
  }

  async resolveStorefrontScope(actor: Actor): Promise<Scope> {
    return this.canonical.resolve(actor, 'catalog.listings.read');
  }
}
