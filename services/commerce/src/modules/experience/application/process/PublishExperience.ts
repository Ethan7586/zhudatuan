import { CACHE_CATALOG } from '@shop/config/runtime';
import type { Cache } from '../../../../platform/cache/Cache';
import { VersionedKey } from '../../../../platform/cache/VersionedKey';
import type { StoredObject } from '../../../runtime/public/ObjectPort';
import { mapParallel } from '@shop/kernel';
import type { TransactionManager, TransactionOptions } from '../../../../platform/database/TransactionManager';
import type { ExperiencePublicationRepository, PublicationTarget } from '../port/ExperiencePublicationRepository';
import type { ExperienceObserver } from '../port/ExperienceObserver';
import { safeErrorCode } from '../../../../platform/error/SafeError';
import type { ExperienceDocument } from '@shop/contract';

export interface ExperiencePublisher {
  publish(path: string, document: unknown, expectedHash: string, signal: AbortSignal): Promise<StoredObject>;
}

export interface ExperiencePublishRequest {
  readonly event: string;
  readonly application: string;
  readonly release: string;
  readonly version: string;
  readonly path: string;
  readonly hash: string;
  readonly scope: string;
  readonly trace: string;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

interface PublishedExperience {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly hash: string;
  readonly document: ExperienceDocument;
  readonly effectiveAt: string;
  readonly objectKey: string;
}

export class PublishExperience {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ExperiencePublicationRepository,
    private readonly publisher: ExperiencePublisher,
    private readonly cache: Cache,
    private readonly observer: ExperienceObserver
  ) {}

  async execute(request: ExperiencePublishRequest): Promise<void> {
    const started = performance.now();
    try {
      await this.publish(request);
      this.observer.publication({ trace: request.trace, result: 'success', milliseconds: performance.now() - started });
    } catch (cause) {
      const code = safeErrorCode(cause, 'EXPERIENCE_PUBLICATION_FAILED');
      await this.recordFailure(request, code).catch(() => undefined);
      this.observer.publication({ trace: request.trace, result: 'failure', milliseconds: performance.now() - started, errorCode: code });
      throw cause;
    }
  }

  private async publish(request: ExperiencePublishRequest): Promise<void> {
    const target = await this.transactions.read(this.options(request, 'select'), (context) => this.repository.target(context, request.release));
    if (!target) throw new Error('EXPERIENCE_RELEASE_NOT_FOUND');
    if (target.application !== request.application || target.version !== request.version || target.hash !== request.hash) {
      throw new Error('EXPERIENCE_EVENT_RELEASE_MISMATCH');
    }
    if (!['scheduled', 'active', 'failed'].includes(target.state)) return this.complete(request);
    const stored = await this.publisher.publish(request.path, target.configuration, request.hash, request.signal);
    const publication = await this.transactions.write(this.options(request, 'activate'), (context) => this.repository.activate(context, request.event, target, request.path, stored));
    if (publication.active) {
      await this.publishCache(publication.malls, target, request.path);
      await mapParallel(publication.handles, 16, (handle) => this.cache.remove(VersionedKey.create('storefrontentry', { handle })));
    }
    await this.complete(request);
  }

  private complete(request: ExperiencePublishRequest): Promise<void> {
    return this.transactions.write(this.options(request, 'complete'), (context) => this.repository.complete(context, request.event));
  }

  private async recordFailure(request: ExperiencePublishRequest, code: string): Promise<void> {
    const target = await this.transactions.read(this.options(request, 'failureselect'), (context) => this.repository.target(context, request.release));
    if (!target || target.state === 'active' || target.state === 'retired') return;
    await this.transactions.write(this.options(request, 'failure'), (context) => this.repository.fail(context, request.event, target, code));
  }

  private async publishCache(malls: readonly string[], target: PublicationTarget, path: string): Promise<void> {
    await mapParallel(malls, 16, async (mall) => {
      const value: PublishedExperience = Object.freeze({
        application: target.application,
        mall,
        pool: target.pool,
        release: target.release,
        version: target.version,
        hash: target.hash,
        document: target.configuration,
        effectiveAt: target.effectiveAt,
        objectKey: path,
      });
      const versionKey = VersionedKey.create('publishedexperience', { mall, publicationversion: target.version });
      const activeKey = VersionedKey.create('publishedexperience', { mall, publicationversion: 'active' });
      if (await this.cache.put(versionKey, value, CACHE_CATALOG.publishedexperience.maximumSeconds)) {
        await this.cache.put(activeKey, target.version, Math.max(1, CACHE_CATALOG.publishedexperience.staleSeconds));
      }
    });
  }

  private options(request: ExperiencePublishRequest, action: string): TransactionOptions {
    return {
      tenant: request.scope,
      membership: '',
      scope: request.scope,
      actor: 'job:experiencepublish',
      trace: request.trace,
      operation: `job.experience.${action}`,
      workload: 'jobs',
      signal: request.signal,
      deadline: request.deadline,
    };
  }
}
