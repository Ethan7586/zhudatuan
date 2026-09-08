import { parseExperience, serializeExperience } from '@shop/contract';
import { createHash } from 'node:crypto';
import { CACHE_CATALOG } from '@shop/config/runtime';
import type { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { Cache } from '../../../../platform/cache/Cache';
import { VersionedKey } from '../../../../platform/cache/VersionedKey';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { EntryResolver } from '../../application/service/EntryResolver';
import type { ExperienceChannel, ExperienceReadPort, PublishedExperience, PublishedStorefront, StorefrontEntry } from '../../public/ExperienceReadPort';

interface PublishedRow extends Record<string, unknown> {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly hash: string;
  readonly document: unknown;
  readonly effective_at: Date | string;
  readonly object_key: string;
}
interface CachedPublished {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly hash: string;
  readonly document: ReturnType<typeof parseExperience>;
  readonly effectiveAt: string;
  readonly objectKey: string;
}

export class PgExperienceReadPort implements ExperienceReadPort {
  constructor(
    private readonly resolver: EntryResolver,
    private readonly cache: Cache,
    private readonly transactions: PgTransactionAccess
  ) {}

  resolveEntry(context: ReadTransactionContext, handle: string): Promise<StorefrontEntry> {
    return this.resolver.resolve(context, handle);
  }

  async published(context: ReadTransactionContext, entry: StorefrontEntry): Promise<PublishedStorefront> {
    const cached = await this.version(entry.mall, entry.version);
    if (cached && cached.release === entry.release && cached.application === entry.application && cached.hash === entry.contentHash) {
      return Object.freeze({ document: cached.document, version: cached.version, asOf: cached.effectiveAt });
    }
    const row = await this.read(context, `release.id=$1 and application.id=$2`, [entry.release, entry.application]);
    if (!row) throw new Error('STOREFRONT_RELEASE_NOT_PUBLISHED');
    await this.write(row);
    return Object.freeze({ document: row.document, version: row.version, asOf: row.effectiveAt });
  }

  async publishedFor(context: ReadTransactionContext, input: Readonly<{ mall: string; channel: ExperienceChannel; locale: string }>): Promise<PublishedExperience | null> {
    if (!['web', 'miniapp', 'store'].includes(input.channel) || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.locale)) return null;
    const selected = await this.cache.get<unknown>(activeKey(input.mall)).catch(() => null);
    const active = typeof selected === 'string' && selected.length >= 3 && selected.length <= 255 ? selected : null;
    const cached = active === null ? null : await this.version(input.mall, active);
    const value = cached ?? (await this.read(context, `application.mall_id=$1`, [input.mall]));
    if (!value) return null;
    if (!cached) await this.write(value);
    return Object.freeze({ ...value, asOf: value.effectiveAt, channel: input.channel, locale: input.locale, etag: `"${value.hash}"` });
  }

  private async read(context: ReadTransactionContext, predicate: string, parameters: readonly unknown[]): Promise<CachedPublished | null> {
    const result = await this.transactions.database(context).query<PublishedRow>(
      `select application.id application,application.mall_id mall,
      release.pool_id pool,release.id release,version.id version,publication.content_hash hash,version.configuration document,
      release.effective_at,publication.object_key from experience.application application
      join experience.release release on release.application_id=application.id and release.state='active' and release.effective_at<=clock_timestamp()
      join experience.publication publication on publication.release_id=release.id and publication.state='active'
      join experience.version version on version.id=release.version_id and version.validation_state='valid' and version.frozen_at is not null
      where ${predicate} order by application.is_primary desc,release.effective_at desc,release.id desc limit 1`,
      [...parameters]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          application: row.application,
          mall: row.mall,
          pool: row.pool,
          release: row.release,
          version: row.version,
          hash: row.hash,
          document: parseExperience(row.document),
          effectiveAt: iso(row.effective_at),
          objectKey: row.object_key,
        })
      : null;
  }

  private async version(mall: string, version: string): Promise<CachedPublished | null> {
    const value = await this.cache.get<unknown>(versionKey(mall, version)).catch(() => null);
    return cached(value, mall, version);
  }

  private async write(value: CachedPublished): Promise<void> {
    await this.cache.put(versionKey(value.mall, value.version), value, CACHE_CATALOG.publishedexperience.maximumSeconds).catch(() => false);
    await this.cache.put(activeKey(value.mall), value.version, Math.max(1, CACHE_CATALOG.publishedexperience.staleSeconds)).catch(() => false);
  }
}

function activeKey(mall: string): string {
  return VersionedKey.create('publishedexperience', { mall, publicationversion: 'active' });
}
function versionKey(mall: string, version: string): string {
  return VersionedKey.create('publishedexperience', { mall, publicationversion: version });
}
function iso(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('EXPERIENCE_TIME_INVALID');
  return parsed.toISOString();
}
function cached(value: unknown, mall: string, version: string): CachedPublished | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Reflect.get(value, 'mall') !== mall || Reflect.get(value, 'version') !== version) return null;
  const hash = Reflect.get(value, 'hash');
  if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) return null;
  try {
    const document = parseExperience(Reflect.get(value, 'document'));
    if (createHash('sha256').update(serializeExperience(document)).digest('hex') !== hash) return null;
    const effectiveAt = iso(String(Reflect.get(value, 'effectiveAt')));
    const fields = ['application', 'pool', 'release', 'objectKey'] as const;
    if (fields.some((field) => typeof Reflect.get(value, field) !== 'string' || String(Reflect.get(value, field)).length === 0)) return null;
    return Object.freeze({
      application: String(Reflect.get(value, 'application')),
      mall,
      pool: String(Reflect.get(value, 'pool')),
      release: String(Reflect.get(value, 'release')),
      version,
      hash,
      document,
      effectiveAt,
      objectKey: String(Reflect.get(value, 'objectKey')),
    });
  } catch {
    return null;
  }
}
