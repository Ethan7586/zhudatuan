import type { Scope } from '@shop/authz';
import type { Actor } from './AccessContext';

export interface ScopeResolver {
  resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope>;
}
