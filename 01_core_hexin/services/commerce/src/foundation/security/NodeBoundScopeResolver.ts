import type { Scope } from '@shop/authz';
import type { Actor } from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';

export class NodeBoundScopeResolver implements ScopeResolver {
  constructor(private readonly next: ScopeResolver, private readonly scopeId: string) {}

  async resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope> {
    const scope = await this.next.resolve(actor, operation, resource, scopeHint);
    const nodeScope = scope.kind === 'owner' ? scope.tenant : scope.id;
    if (nodeScope !== this.scopeId) throw new Error('NODE_SCOPE_MISMATCH');
    return scope;
  }
}
