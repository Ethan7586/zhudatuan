import { CACHE_CATALOG } from '@shop/config/runtime';
import type { Cache } from '../../../../foundation/cache/Cache';
import { VersionedKey } from '../../../../foundation/cache/VersionedKey';
import type { StoredObject } from '../../../../foundation/infrastructure/ObjectStore';
import { mapParallel } from '../../../../foundation/performance/Parallel';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { ExperiencePublicationRepository, PublicationTarget } from '../port/ExperiencePublicationRepository';

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
  readonly release: string;
  readonly version: string;
  readonly hash: string;
  readonly document: unknown;
  readonly effective_at: string;
  readonly object_key: string;
}

export class PublishExperience {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: ExperiencePublicationRepository,
    private readonly publisher: ExperiencePublisher,
    private readonly cache: Cache
  ) {}

  async execute(request: ExperiencePublishRequest): Promise<void> {
    const target = await this.transactions.read(this.options(request, 'select'), (context) => this.repository.target(context, request.release));
    if (!target) throw new Error('EXPERIENCE_RELEASE_NOT_FOUND');
    if (target.application !== request.application || target.version !== request.version || target.hash !== request.hash) {
      throw new Error('EXPERIENCE_EVENT_RELEASE_MISMATCH');
    }
    if (!['scheduled', 'active'].includes(target.state)) return this.complete(request);
    const stored = await this.publisher.publish(request.path, target.configuration, request.hash, request.signal);
    const publication = await this.transactions.write(this.options(request, 'activate'), (context) => this.repository.activate(context, request.event, target, request.path, stored));
    if (publication.active) await this.publishCache(publication.malls, target, request.path);
  }

  private complete(request: ExperiencePublishRequest): Promise<void> {
    return this.transactions.write(this.options(request, 'complete'), (context) => this.repository.complete(context, request.event));
  }

  private async publishCache(malls: readonly string[], target: PublicationTarget, path: string): Promise<void> {
    const value: PublishedExperience = Object.freeze({
      release: target.release,
      version: target.version,
      hash: target.hash,
      document: target.configuration,
      effective_at: target.effectiveAt,
      object_key: path,
    });
    await mapParallel(malls, 16, async (mall) => {
      const versionKey = VersionedKey.create('experience', { mall, version: target.version });
      const activeKey = VersionedKey.create('experience', { mall, version: 'active' });
      if (await this.cache.put(versionKey, value, CACHE_CATALOG.experience.maximumSeconds)) {
        await this.cache.put(activeKey, target.version, Math.max(1, CACHE_CATALOG.experience.staleSeconds));
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
