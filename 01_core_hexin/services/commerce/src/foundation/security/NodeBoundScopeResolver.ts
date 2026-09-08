import type { Scope } from '@shop/authz';
import type { Actor } from './AccessContext';
import type { ScopeResolver } from './ScopeResolver';

type OwnerNodeScopeResolver = (actor: Actor) => Promise<Scope>;

export class NodeBoundScopeResolver implements ScopeResolver {
  constructor(
    private readonly next: ScopeResolver,
    private readonly scopeId: string,
    private readonly resolveOwnerNodeScope?: OwnerNodeScopeResolver,
  ) {}

  async resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope> {
    const scope = await this.next.resolve(actor, operation, resource, scopeHint);
    let nodeScope = scope;
    if (scope.kind === 'owner') {
      if (!this.resolveOwnerNodeScope) throw new Error('NODE_SCOPE_MISMATCH');
      nodeScope = await this.resolveOwnerNodeScope(actor);
    }
    if (nodeScope.id !== this.scopeId) throw new Error('NODE_SCOPE_MISMATCH');
    return scope;
  }
}
