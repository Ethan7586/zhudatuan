import { WECOM_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { TransactionManager, TransactionOptions } from '../../../../foundation/persistence/TransactionManager';
import type { KmsClient } from '../../../../foundation/application/KmsPort';
import type { DirectoryRepository } from '../port/DirectoryRepository';
import type { DirectoryProviderRegistry } from './DirectoryProviderRegistry';
import type { DirectoryReconciler } from './DirectoryReconciler';
import type { DirectoryMapper } from '../port/DirectoryMapper';
import type { DirectoryPolicy } from '../../domain/policy/DirectoryPolicy';
import type { MembershipLifecycle } from './MembershipLifecycle';
import { safeErrorCode } from '../../../../foundation/domain/SafeError';

export class DirectorySynchronization {
  constructor(
    private readonly transactions: TransactionManager,
    private readonly repository: DirectoryRepository,
    private readonly providers: DirectoryProviderRegistry,
    private readonly mapper: DirectoryMapper,
    private readonly reconciler: DirectoryReconciler,
    private readonly policy: DirectoryPolicy,
    private readonly lifecycle: MembershipLifecycle,
    private readonly kms: KmsClient
  ) {}
  async execute(connectionid: string, runid: string, trace: string, signal: AbortSignal, deadline: number, fence: () => Promise<void>): Promise<void> {
    await fence();
    const connection = await this.transactions.read(this.options('system', connectionid, trace, 'organization.directory.connection', signal, deadline), (context) => this.repository.require(context, connectionid));
    if (!connection.synchronizable()) throw new Error('DIRECTORY_PROVIDER_DISABLED');
    let run = await this.transactions.write(this.options(connection.tenantid, connection.organizationid, trace, 'organization.directory.start', signal, deadline), (context) => this.repository.startRun(context, runid));
    const provider = this.providers.require(connection.providertype);
    if (run.mode === 'event') {
      const encrypted = await this.transactions.read(this.options(connection.tenantid, connection.organizationid, trace, 'organization.directory.event', signal, deadline), (context) => this.repository.event(context, run.id));
      const payload = await this.kms.decrypt('providerconfig', 'organization/directory', encrypted.envelope, { connection: connection.id, event: encrypted.eventid });
      const page = provider.event(connection, payload);
      this.policy.validate(page, connection.successfulversion);
      const subjects = this.mapper.map(connection, page);
      await fence();
      const active = await this.transactions.write(this.options(connection.tenantid, connection.organizationid, trace, 'organization.directory.event.persist', signal, deadline), async (context) => {
        if (!(await this.repository.active(context, run.id))) return false;
        const counts = await this.reconciler.reconcile(context, connection, subjects, trace);
        if (!(await this.repository.advance(context, run.id, page, counts))) throw new Error('DIRECTORY_SYNC_CANCELLED');
        await this.repository.complete(context, run.id, connection.id, page.version, connection.cursor);
        await this.repository.markEventProcessed(context, connection.id, page.eventid);
        return true;
      });
      if (!active) return;
      return;
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
      const active = await this.transactions.write(this.options(connection.tenantid, connection.organizationid, trace, 'organization.directory.page.persist', signal, deadline), async (context) => {
        if (!(await this.repository.active(context, run.id))) return false;
        const staged = await this.repository.stage(context, run, page, subjects);
        const counts = !staged ? emptyCounts() : run.preview ? await this.reconciler.preview(context, connection, subjects) : await this.reconciler.reconcile(context, connection, subjects, trace);
        if (!(await this.repository.advance(context, run.id, { ...page, cursor: protectedcursor }, counts))) throw new Error('DIRECTORY_SYNC_CANCELLED');
        if (page.complete) {
          const previewDepartures = run.preview && run.mode === 'full' ? await this.repository.previewDepartures(context, connection.id, run.id) : [];
          await this.repository.complete(context, run.id, connection.id, page.version, protectedcursor);
          const departures = run.preview ? previewDepartures : await this.repository.departures(context, connection.id);
          for (const departure of run.preview ? [] : departures) {
            await this.lifecycle.apply(context, { membership: departure.membership, organization: connection.organizationid, department: null, action: 'freeze', explicitdeparture: false, trace });
            await this.repository.freeze(context, connection.id, departure.subject);
          }
          await this.repository.recordDepartures(context, run.id, departures.length);
        }
        return true;
      });
      if (!active) return;
      cursor = page.cursor;
      if (page.complete) return;
    }
    throw new Error('DIRECTORY_PAGE_LIMIT_EXCEEDED');
  }
  fail(run: string, cause: unknown, trace: string, signal: AbortSignal, deadline: number): Promise<void> {
    return this.transactions.write(this.options('system', 'system', trace, 'organization.directory.fail', signal, deadline), (context) => this.repository.fail(context, run, safeErrorCode(cause, 'DIRECTORY_SYNC_FAILED')));
  }

  private options(tenant: string, scope: string, trace: string, operation: string, signal: AbortSignal, deadline: number): TransactionOptions {
    return { tenant, membership: 'system', scope, actor: 'system', trace, operation, deadline, signal, workload: 'jobs' };
  }
}

function emptyCounts() {
  return Object.freeze({ read: 0, applied: 0, creates: 0, updates: 0, freezes: 0, restores: 0, conflicts: 0, ignored: 0 });
}
