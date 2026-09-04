import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { encodeCursor, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { RiskAdministrationRepository } from '../port/RiskAdministrationRepository';
import type { MemberReadPort } from '../../../member/public';

export class CenterReadHandler implements OperationHandler<'risk.center.read', 'read'> {
  readonly operation = 'risk.center.read' as const;
  readonly mode = 'read' as const;

  constructor(
    private readonly risks: RiskAdministrationRepository,
    private readonly members: Pick<MemberReadPort, 'principals'>
  ) {}

  async execute(input: OperationInputFor<'risk.center.read'>, context: HandlerContext<'risk.center.read'>): Promise<OperationReply<OperationOutputFor<'risk.center.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input, 200);
    const rows = await this.risks.center(context.transaction, access.scope.id, page.id, page.fetch);
    const more = rows.length > page.limit;
    const selected = more ? rows.slice(0, page.limit) : rows;
    const principals = selected.flatMap((item) => (item.kind === 'case' && typeof item.actor_id === 'string' ? [item.actor_id] : []));
    const profiles = await this.members.principals(context.transaction, principals, access.scope.id);
    const byPrincipal = new Map(profiles.map((profile) => [profile.principal, profile]));
    const items = selected.map((item) => {
      const actor = typeof item.actor_id === 'string' ? byPrincipal.get(item.actor_id) : undefined;
      return Object.freeze({ ...item, actor_display_name: actor?.displayName ?? null, actor_mobile_masked: actor?.mobileMasked ?? null });
    });
    const id = items.at(-1)?.id;
    const body = { items: [...items], count: items.length, ...(more && id ? { nextCursor: encodeCursor({ sort: id, id }) } : {}) };
    return { status: 200, body: body as OperationOutputFor<'risk.center.read'> };
  }
}
