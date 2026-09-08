import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { AccessAdministrationRepository } from '../port/AccessAdministrationRepository';

export class CenterReadHandler implements OperationHandler<'access.center.read', 'read'> {
  readonly operation = 'access.center.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly access: AccessAdministrationRepository) {}
  async execute(input: OperationInputFor<'access.center.read'>, context: HandlerContext<'access.center.read'>): Promise<OperationReply<OperationOutputFor<'access.center.read'>>> {
    const identity = requireSession(context.security);
    const page = queryPage(input);
    const [rows, roles, templates, separationRules] = await Promise.all([
      this.access.center(context.transaction, { organization: identity.scope.id, after: page.id, limit: page.fetch }),
      this.access.roles(context.transaction, identity.scope.id),
      this.access.roleTemplates(context.transaction),
      this.access.separationRules(context.transaction),
    ]);
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
    return {
      status: 200,
      body: {
        ...result,
        items: [...result.items],
        roles: roles.map((role) => ({ ...role, allows: [...role.allows], denies: [...role.denies], members: role.members.map((member) => ({ ...member })) })),
        templates: templates.map((template) => ({ ...template, allows: [...template.allows], denies: [...template.denies] })),
        separationRules: separationRules.map((rule) => ({ ...rule })),
      } as OperationOutputFor<'access.center.read'>,
    };
  }
}
