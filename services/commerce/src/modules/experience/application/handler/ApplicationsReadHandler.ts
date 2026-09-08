import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ApplicationRepository } from '../port/ApplicationRepository';
import type { ExperienceObserver } from '../port/ExperienceObserver';

export class ApplicationsReadHandler implements OperationHandler<'experience.applications.read', 'read'> {
  readonly operation = 'experience.applications.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly applications: ApplicationRepository,
    private readonly observer: ExperienceObserver
  ) {}
  async execute(input: OperationInputFor<'experience.applications.read'>, context: HandlerContext<'experience.applications.read'>): Promise<OperationReply<OperationOutputFor<'experience.applications.read'>>> {
    const access = requireSession(context.security);
    const page = queryPage(input);
    const application = queryText(input.query?.application);
    const rows = await this.applications.readSummaries(context.transaction, { scope: organizationScope(access.scope), application, page });
    this.observer.states(context.transaction, {
      ready: rows.filter((row) => row.entry.state === 'ready').length,
      unpublished: rows.filter((row) => row.entry.state === 'unpublished').length,
      disabled: rows.filter((row) => row.entry.state === 'disabled').length,
      invalid: rows.filter((row) => row.entry.state === 'invalid').length,
    });
    return { status: 200, body: keysetPage(rows, page, 'updatedAt') as OperationOutputFor<'experience.applications.read'> };
  }
}

function queryText(value: unknown): string {
  return (Array.isArray(value) ? value[0] : value)?.toString().trim().slice(0, 255) ?? '';
}
