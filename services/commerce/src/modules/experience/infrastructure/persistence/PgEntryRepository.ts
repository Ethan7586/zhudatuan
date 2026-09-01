import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { EntryRepository, StorefrontEntry } from '../../application/port/EntryRepository';
import type { StorefrontConfig } from '../../application/port/StorefrontConfig';
import { EntryPolicy } from '../../domain/policy/EntryPolicy';
import { StorefrontAddress } from '../../domain/value/StorefrontAddress';

interface EntryRow extends QueryResultRow {
  readonly application: string;
  readonly handle: string;
  readonly mall: string;
  readonly pool: string | null;
  readonly release: string | null;
  readonly version: string | null;
  readonly tenant: string;
  readonly application_status: string;
  readonly validation_state: string | null;
  readonly publication_state: string | null;
  readonly content_hash: string | null;
  readonly configuration_hash: string | null;
  readonly object_key: string | null;
}

export class PgEntryRepository implements EntryRepository {
  constructor(
    private readonly storefront: StorefrontConfig,
    private readonly transactions = new PgTransactionAccess(),
    private readonly policy = new EntryPolicy()
  ) {}

  async resolve(context: ReadTransactionContext, handle: string): Promise<StorefrontEntry> {
    let address: StorefrontAddress;
    try {
      address = StorefrontAddress.from(handle, this.storefront);
    } catch {
      throw new DomainError('STOREFRONT_HANDLE_INVALID');
    }
    const result = await this.transactions.database(context).query<EntryRow>(
      `select application,handle,mall,pool,release,version,tenant,application_status,validation_state,
      publication_state,content_hash,configuration_hash,object_key from experience.resolve_storefront_entry($1)`,
      [address.handle]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('STOREFRONT_NOT_FOUND');
    const state = this.policy.decide({
      applicationStatus: row.application_status,
      release: row.release,
      version: row.version,
      validationState: row.validation_state,
      publicationState: row.publication_state,
      contentHash: row.content_hash,
      configurationHash: row.configuration_hash,
      objectKey: row.object_key,
      pool: row.pool,
    });
    if (state === 'disabled') throw new DomainError('STOREFRONT_DISABLED');
    if (state === 'unpublished') throw new DomainError('STOREFRONT_NOT_PUBLISHED');
    if (state === 'invalid') throw new DomainError('STOREFRONT_PUBLICATION_UNAVAILABLE');
    return Object.freeze({
      application: row.application,
      handle: address.handle,
      url: address.url,
      mall: required(row.mall),
      pool: required(row.pool),
      release: required(row.release),
      version: required(row.version),
      tenant: required(row.tenant),
      contentHash: required(row.content_hash),
      objectKey: required(row.object_key),
    });
  }
}

function required(value: string | null): string {
  if (!value) throw new DomainError('STOREFRONT_PUBLICATION_UNAVAILABLE');
  return value;
}
