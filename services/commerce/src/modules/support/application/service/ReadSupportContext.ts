import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { SupportContextPort, SupportContextView } from '../port/SupportPersistence';
import { supportBoundary } from './SupportBoundary';

export interface SupportActorContext {
  readonly actor: string;
  readonly membership: string;
  readonly member: string;
  readonly target: 'console' | 'storefront';
  readonly scope: string;
  readonly scopes: readonly string[];
  readonly trace: string;
}

export class ReadSupportContext {
  constructor(private readonly repository: SupportContextPort) {}

  async actor(context: ReadTransactionContext, execution: ExecutionContext): Promise<SupportActorContext> {
    const access = requireSession(execution.security);
    const scope = supportBoundary(access);
    const [member, scopes] = await Promise.all([this.repository.member(context, access.membership.id), this.repository.descendants(context, scope)]);
    return Object.freeze({ actor: access.actor.id, membership: access.membership.id, member, target: access.actor.target, scope, scopes, trace: access.trace });
  }

  assertOrder(context: ReadTransactionContext, order: string, scope: string, member: string, memberOnly: boolean): Promise<void> {
    return this.repository.assertOrder(context, order, scope, member, memberOnly);
  }

  benefit(context: ReadTransactionContext, type: string, id: string, scope: string, member: string): Promise<Readonly<Record<string, unknown>>> {
    return this.repository.benefit(context, type, id, scope, member);
  }

  view(context: ReadTransactionContext, scope: string, member: string, memberOnly: boolean): Promise<SupportContextView> {
    return this.repository.view(context, scope, member, memberOnly);
  }
}
