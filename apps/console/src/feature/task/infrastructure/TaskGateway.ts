import { createFetchRuntime, type RuntimeOperations } from '@shop/sdk/runtime';
import { createFetchMember, type MemberOperations } from '@shop/sdk/member';
import { createFetchCatalog, type CatalogOperations } from '@shop/sdk/catalog';
import { createFetchInventory, type InventoryOperations } from '@shop/sdk/inventory';
import { createFetchOrder, type OrderOperations } from '@shop/sdk/order';
import { createFetchVoucher, type VoucherOperations } from '@shop/sdk/voucher';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { Task, TaskFilter } from '../model/Task';
import type { TaskPort } from '../public';
import { TaskMapper } from './TaskMapper';
import { ImportUploadGateway } from '../../../shared/import/ImportUploadGateway';
import type { ImportDraft } from '../model/ImportDraft';
import { StatementImportGateway } from '../../../shared/import/StatementImportGateway';

export class TaskGateway implements TaskPort {
  private readonly operations: RuntimeOperations;
  private readonly member: MemberOperations;
  private readonly catalog: CatalogOperations;
  private readonly inventory: InventoryOperations;
  private readonly order: OrderOperations;
  private readonly voucher: VoucherOperations;
  private readonly statements: StatementImportGateway;
  private readonly mapper = new TaskMapper();
  private readonly uploads: ImportUploadGateway;

  constructor(baseUrl: string, clients: Readonly<{ runtime?: RuntimeOperations; member?: MemberOperations; catalog?: CatalogOperations; inventory?: InventoryOperations; order?: OrderOperations; voucher?: VoucherOperations }> = {}) {
    this.operations = clients.runtime ?? createFetchRuntime(baseUrl);
    this.member = clients.member ?? createFetchMember(baseUrl);
    this.catalog = clients.catalog ?? createFetchCatalog(baseUrl);
    this.inventory = clients.inventory ?? createFetchInventory(baseUrl);
    this.order = clients.order ?? createFetchOrder(baseUrl);
    this.voucher = clients.voucher ?? createFetchVoucher(baseUrl);
    this.statements = new StatementImportGateway(baseUrl);
    this.uploads = new ImportUploadGateway(baseUrl);
  }

  async list(context: ConsoleContext, filter: TaskFilter, signal?: AbortSignal) {
    const query = {
      limit: filter.limit,
      ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }),
      ...(filter.type === undefined ? {} : { type: filter.type }),
      ...(filter.state === undefined ? {} : { state: filter.state }),
      ...(filter.owner === undefined ? {} : { owner: filter.owner }),
    };
    return this.mapper.page(await this.operations.jobsRead({ query }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async read(context: ConsoleContext, type: 'import' | 'export', id: string, signal?: AbortSignal) {
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    const value = type === 'import'
      ? await this.operations.importsRead({ path: { importid: id } }, request)
      : await this.operations.exportsRead({ path: { exportid: id } }, request);
    return this.mapper.task(value);
  }

  async createImport(context: ConsoleContext, draft: ImportDraft, identity: string, signal?: AbortSignal) {
    if (!draft.file) throw new Error('IMPORT_FILE_REQUIRED');
    const uploaded = await this.uploads.upload(context, draft.file, signal, undefined, identity);
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      idempotencyKey: identity,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    });
    const source = { objectRef: uploaded.objectRef, sha256: uploaded.sha256, fileName: uploaded.fileName };
    let created: Readonly<{ id: string }>;
    switch (draft.kind) {
      case 'member': created = await this.member.importsCreate({ body: source }, request); break;
      case 'catalog': created = await this.catalog.importsCreate({ body: source }, request); break;
      case 'inventory': created = await this.inventory.importsCreate({ body: source }, request); break;
      case 'order': created = await this.order.importsCreate({ body: source }, request); break;
      case 'voucher':
        created = await this.voucher.credentialsImport({ path: { poolid: draft.pool.trim() }, body: {
          upload: uploaded.objectRef, fileHash: uploaded.sha256, fileName: uploaded.fileName, mediaType: uploaded.mediaType, size: uploaded.size,
        } }, request);
        break;
      case 'finance':
        created = await this.statements.createUploaded(context, uploaded, draft, identity, signal);
        break;
    }
    const task = await this.operations.importsRead(
      { path: { importid: created.id } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
    return this.mapper.task(task);
  }

  async providers(context: ConsoleContext, signal?: AbortSignal) {
    return this.statements.providers(context, signal);
  }

  async cancel(context: ConsoleContext, task: Task, reason: string, identity: string, signal?: AbortSignal) {
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: task.version,
      idempotencyKey: identity,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    });
    const value = task.type === 'export'
      ? await this.operations.exportsCancel({ path: { exportid: task.id }, body: { reason } }, request)
      : await this.operations.jobsCancel({ path: { jobid: task.id }, body: { reason } }, request);
    return this.mapper.task(value);
  }

  async retry(context: ConsoleContext, task: Task, reason: string, identity: string, signal?: AbortSignal) {
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: task.version,
      idempotencyKey: identity,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    });
    return this.mapper.task(await this.operations.importsRetry({ path: { importid: task.id }, body: { reason } }, request));
  }

  async confirm(context: ConsoleContext, task: Task, identity: string, signal?: AbortSignal) {
    if (task.previewHash === null) throw new Error('IMPORT_PREVIEW_REQUIRED');
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: task.version,
      idempotencyKey: identity,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    });
    return this.mapper.task(await this.operations.importsConfirm({ path: { importid: task.id }, body: { previewHash: task.previewHash } }, request));
  }
}
