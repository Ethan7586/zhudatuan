import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { InstallationRepository } from '../port/InstallationRepository';

export class InstallationsReadHandler implements OperationHandler<'extension.installations.read', 'read'> {
  readonly operation = 'extension.installations.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly installations: InstallationRepository) {}
  async execute(input: OperationInputFor<'extension.installations.read'>, context: HandlerContext<'extension.installations.read'>): Promise<OperationReply<OperationOutputFor<'extension.installations.read'>>> {
    requireSession(context.security);
    const page = queryPage(input);
    const rows = await this.installations.list(context.transaction, page, page.fetch);
    const result = keysetPage(rows, page, 'installed_at');
    return {
      status: 200,
      body: {
        ...result,
        items: result.items.map((item) => ({
          ...item,
          manifest: {
            ...item.manifest,
            capabilities: [...item.manifest.capabilities],
            dependencies: item.manifest.dependencies.map((dependency) => ({ ...dependency, capabilities: [...dependency.capabilities] })),
            permissions: [...item.manifest.permissions],
            eventSubscriptions: [...item.manifest.eventSubscriptions],
            secretRefs: [...item.manifest.secretRefs],
            sandbox: { ...item.manifest.sandbox },
            rateLimits: { ...item.manifest.rateLimits },
            timeout: { ...item.manifest.timeout },
            retryPolicy: { ...item.manifest.retryPolicy },
            circuitPolicy: { ...item.manifest.circuitPolicy },
          },
        })),
      },
    };
  }
}
