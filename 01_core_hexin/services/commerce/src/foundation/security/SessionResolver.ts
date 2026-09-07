import type { ResolvedNodeContext } from '@shop/config/sfl-node-kernel';
import { requireRequestNodeContext, type Actor, type NodeContextActor } from './AccessContext';

export function sessionNodeContext(headers: Readonly<Record<string, string>>): ResolvedNodeContext {
  return requireRequestNodeContext(headers);
}

export interface SessionResolver {
  resolve(headers: Readonly<Record<string, string>>): Promise<Actor>;
}

export interface RuntimeSessionResolver extends SessionResolver {
  resolve(headers: Readonly<Record<string, string>>): Promise<NodeContextActor>;
}
