import type { Scope } from '@shop/authz';
import type { Actor } from './AccessContext';

export interface ScopeResolver {
<<<<<<< HEAD
  resolve(actor: Actor, operation: string, resource?: string, scopeHint?: string): Promise<Scope>;
=======
  resolve(actor: Actor, operation: string, resource?: string): Promise<Scope>;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
}
