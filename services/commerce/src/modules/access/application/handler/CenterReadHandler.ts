import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { keysetPage, queryPage } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { AccessAdministrationRepository } from '../port/AccessAdministrationRepository';

export class CenterReadHandler implements OperationHandler<'access.center.read', 'read'> {
  readonly operation = 'access.center.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly access: AccessAdministrationRepository) {}
  async execute(input: OperationInputFor<'access.center.read'>, context: HandlerContext<'access.center.read'>): Promise<OperationReply<OperationOutputFor<'access.center.read'>>> {
    const identity = requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.access.center(context.transaction, { organization: identity.scope.id, after: page.id, limit: page.fetch });
    const items = rows.map((row) => ({
      id: row.id,
      display_name: row.displayName,
      employee_no: row.employeeNo,
      mobile_masked: row.mobileMasked,
      client: row.client,
      status: row.status,
      access_version: row.accessVersion,
      roles: [...row.roles],
      scopes: [...row.scopes],
      overrides: [...row.overrides],
    }));
    const result = keysetPage(items, page, 'id');
    return { status: 200, body: { ...result, items: [...result.items] } as OperationOutputFor<'access.center.read'> };
  }
}
