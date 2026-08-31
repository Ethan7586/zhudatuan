import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DirectoryRepository } from '../port/DirectoryRepository';
import type { DirectoryProviderRegistry } from './DirectoryProviderRegistry';
import type { DirectoryReconciler } from './DirectoryReconciler';
import type { DirectoryMapper } from '../port/DirectoryMapper';
import type { DirectoryPolicy } from '../../domain/policy/DirectoryPolicy';
import type { MembershipLifecycle } from './MembershipLifecycle';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';

export class DirectorySyncService {
  constructor(
    private readonly pool: DatabasePool,
    private readonly repository: DirectoryRepository,
    private readonly providers: DirectoryProviderRegistry,
    private readonly mapper: DirectoryMapper,
    private readonly reconciler: DirectoryReconciler,
    private readonly policy: DirectoryPolicy,
    private readonly lifecycle: MembershipLifecycle,
    private readonly kms: KmsClient
  ) {}
  async execute(connectionid: string, runid: string, trace: string, signal: AbortSignal, fence: () => Promise<void>): Promise<void> {
    await fence();
    const connection = await this.repository.require(this.pool, connectionid);
    if (!connection.synchronizable()) throw new Error('DIRECTORY_PROVIDER_DISABLED');
    let run = await this.repository.startRun(this.pool, runid);
    const provider = this.providers.require(connection.providertype);
    if (run.mode === 'event') {
      const encrypted = await this.repository.event(this.pool, run.id);
      const payload = await this.kms.decrypt('providerconfig', 'organization/directory', encrypted.envelope, { connection: connection.id, event: encrypted.eventid });
      const page = provider.event(connection, payload);
      this.policy.validate(page, connection.successfulversion);
      const subjects = this.mapper.map(connection, page);
      await fence();
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        const counts = await this.reconciler.reconcile(client, connection, subjects, trace);
        await this.repository.advance(client, run.id, page, counts);
        await this.repository.complete(client, run.id, connection.id, page.version, connection.cursor);
        await client.query(`update organization.directoryinbox set state='processed',processed_at=clock_timestamp() where connection_id=$1 and provider_event_id=$2`, [connection.id, page.eventid]);
        await client.query('commit');
        return;
      } catch (cause) {
        await client.query('rollback');
        throw cause;
      } finally {
        client.release();
      }
    }
    let cursor = run.cursor === null ? null : await this.kms.decrypt('providerconfig', 'organization/directory', run.cursor, { connection: connection.id });
    let previous = connection.successfulversion;
    for (let pageindex = 0; pageindex < WECOM_PROVIDER_CONFIGURATION.maximumPages; pageindex += 1) {
      if (signal.aborted) throw signal.reason ?? new Error('OPERATION_ABORTED');
      await fence();
      const page = await provider.changes(connection, cursor, signal);
      this.policy.validate(page, previous);
      previous = page.version;
      const subjects = this.mapper.map(connection, page);
      const protectedcursor = page.cursor === null ? null : (await this.kms.encrypt('providerconfig', 'organization/directory', page.cursor, { connection: connection.id })).ciphertext;
      await fence();
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        const staged = await this.repository.stage(client, run, page, subjects);
        const counts = staged ? await this.reconciler.reconcile(client, connection, subjects, trace) : { read: 0, applied: 0, conflicts: 0, ignored: 0 };
        await this.repository.advance(client, run.id, { ...page, cursor: protectedcursor }, counts);
        if (page.complete) {
          await this.repository.complete(client, run.id, connection.id, page.version, protectedcursor);
          for (const departure of await this.repository.departures(client, connection.id)) {
            await this.lifecycle.apply(client, { membership: departure.membership, organization: connection.organizationid, department: null, action: 'freeze', explicitdeparture: false, trace });
            await this.repository.freeze(client, connection.id, departure.subject);
          }
        }
        await client.query('commit');
      } catch (cause) {
        await client.query('rollback');
        throw cause;
      } finally {
        client.release();
      }
      cursor = page.cursor;
      if (page.complete) return;
    }
    throw new Error('DIRECTORY_PAGE_LIMIT_EXCEEDED');
  }
  fail(run: string, cause: unknown): Promise<void> {
    return this.repository.fail(this.pool, run, safeErrorCode(cause, 'DIRECTORY_SYNC_FAILED'));
  }
}
