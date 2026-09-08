import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ExperienceChannel, ExperienceReadPort } from '../../public/ExperienceReadPort';

export class PublishedReadHandler implements OperationHandler<'experience.published.read', 'read'> {
  readonly operation = 'experience.published.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly experience: ExperienceReadPort) {}
  async execute(input: OperationInputFor<'experience.published.read'>, context: HandlerContext<'experience.published.read'>): Promise<OperationReply<OperationOutputFor<'experience.published.read'>>> {
    requireSession(context.security);
    const query = input.query ?? {};
    const published = await this.experience.publishedFor(context.transaction, {
      mall: text(query.mall, 'mall'),
      channel: channel(query.channel),
      locale: locale(query.locale),
    });
    if (!published) throw new DomainError('STOREFRONT_NOT_PUBLISHED');
    return {
      status: 200,
      body: {
        application: published.application,
        mall: published.mall,
        pool: published.pool,
        release: published.release,
        version: published.version,
        hash: published.hash,
        document: published.document,
        effectiveAt: published.effectiveAt,
        objectKey: published.objectKey,
        channel: published.channel,
        locale: published.locale,
        etag: published.etag,
      } as OperationOutputFor<'experience.published.read'>,
      headers: { etag: published.etag, 'cache-control': 'private,max-age=0,must-revalidate' },
    };
  }
}

function channel(value: unknown): ExperienceChannel {
  const result = text(value, 'channel');
  if (!['web', 'miniapp', 'store'].includes(result)) throw new DomainError('VALIDATION_FAILED', { field: 'channel' });
  return result as ExperienceChannel;
}
function locale(value: unknown): string {
  const result = text(value, 'locale');
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(result)) throw new DomainError('VALIDATION_FAILED', { field: 'locale' });
  return result;
}
function text(value: unknown, field: string): string {
  const result = (Array.isArray(value) ? value[0] : value)?.toString().trim() ?? '';
  if (!result || result.length > 255) throw new DomainError('VALIDATION_FAILED', { field });
  return result;
}
