import * as Operation from '@shop/contract/ids';
import type { RequestContext } from '@shop/sdk';
import { createFetchVoucher, VOUCHER_METHOD_BY_OPERATION, type VoucherOperations } from '@shop/sdk/voucher';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { VoucherChoiceKind, VoucherChoicePage, VoucherCommand, VoucherCommandInput, VoucherExecutionOptions, VoucherFacets, VoucherOperation, VoucherProgress, VoucherProgressKind, VoucherReadQuery, VoucherReceipt, VoucherRecord, VoucherRecordPage, VoucherTimeline, VoucherView } from '../model/Voucher';
import { voucherReadOperations } from '../model/VoucherOperationCatalog';
import type { VoucherPort } from '../public';
import { VoucherMapper } from './VoucherMapper';

type VoucherInvoker = (input: never, context: RequestContext) => Promise<unknown>;

export class VoucherGateway implements VoucherPort {
  private readonly client: VoucherOperations;

  constructor(baseUrl: string, private readonly mapper = new VoucherMapper(), client?: VoucherOperations) {
    this.client = client ?? createFetchVoucher(baseUrl);
  }

  async read(context: ConsoleContext, view: VoucherView, query: VoucherReadQuery, signal?: AbortSignal): Promise<VoucherRecordPage> {
    const page = { limit: 50, ...(query.cursor ? { cursor: query.cursor } : {}), ...(query.state ? { state: query.state } : {}) };
    if (view === 'products') return this.mapper.page(view, await this.request(context, Operation.OP_VOUCHER_PRODUCTS_LIST, { query: page }, { signal }));
    if (view === 'pools') return this.mapper.page(view, await this.request(context, Operation.OP_VOUCHER_CREDENTIALPOOLS_LIST, { query: page }, { signal }));
    if (view === 'credentials') return this.mapper.page(view, await this.request(context, Operation.OP_VOUCHER_CREDENTIALS_LIST, { query: page }, { signal }));
    if (view === 'stocks') return this.mapper.page(view, await this.request(context, Operation.OP_VOUCHER_STOCKREQUESTS_LIST, { query: page }, { signal }));
    if (view === 'issues') return this.mapper.page(view, await this.request(context, Operation.OP_VOUCHER_ISSUEORDERS_LIST, { query: page }, { signal }));
    if (view === 'actions') return this.mapper.page(view, await this.request(context, Operation.OP_VOUCHER_ACTIONBATCHES_LIST, { query: page }, { signal }));
    if (view === 'redemptions') {
      if (!query.query) return Object.freeze({ items: Object.freeze([]), count: 0 });
      const value = await this.request(context, Operation.OP_VOUCHER_REDEMPTIONS_GET, { path: { redemptionid: query.query } }, { signal });
      return Object.freeze({ items: Object.freeze([this.mapper.single(view, value)]), count: 1 });
    }
    const filter = { limit: 50, ...(query.cursor ? { cursor: query.cursor } : {}), ...(query.query ? { query: query.query } : {}), ...(query.state ? { state: query.state } : {}) };
    return this.mapper.page(view, await this.request(context, Operation.OP_VOUCHER_SEARCH_READ, { query: filter }, { signal }));
  }

  async detail(context: ConsoleContext, view: VoucherView, id: string, signal?: AbortSignal): Promise<VoucherRecord> {
    if (view === 'products') return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_PRODUCTS_GET, { path: { productid: id } }, { signal }));
    if (view === 'pools') return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_CREDENTIALPOOLS_GET, { path: { poolid: id } }, { signal }));
    if (view === 'credentials') return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_CREDENTIALS_GET, { path: { credentialid: id } }, { signal }));
    if (view === 'stocks') return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_STOCKREQUESTS_GET, { path: { requestid: id } }, { signal }));
    if (view === 'issues') return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_ISSUEORDERS_GET, { path: { orderid: id } }, { signal }));
    if (view === 'actions') return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_ACTIONBATCHES_GET, { path: { actionbatchid: id } }, { signal }));
    if (view === 'redemptions') return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_REDEMPTIONS_GET, { path: { redemptionid: id } }, { signal }));
    return this.mapper.single(view, await this.request(context, Operation.OP_VOUCHER_VOUCHERS_GET, { path: { voucherid: id } }, { signal }));
  }

  async choices(context: ConsoleContext, kind: VoucherChoiceKind, signal?: AbortSignal): Promise<VoucherChoicePage> {
    const operation = kind === 'product' ? Operation.OP_VOUCHER_PRODUCTOPTIONS_LIST : Operation.OP_VOUCHER_STOCKREQUESTOPTIONS_LIST;
    return this.mapper.choices(kind, await this.request(context, operation, { query: { limit: 100 } }, { signal }));
  }

  async facets(context: ConsoleContext, query: VoucherReadQuery, signal?: AbortSignal): Promise<VoucherFacets> {
    return this.mapper.facets(await this.request(context, Operation.OP_VOUCHER_SEARCHFACETS_READ, { query: { ...(query.query ? { query: query.query } : {}), ...(query.state ? { state: query.state } : {}) } }, { signal }));
  }

  async byNumber(context: ConsoleContext, number: string, signal?: AbortSignal): Promise<VoucherRecord> {
    return this.mapper.single('search', await this.request(context, Operation.OP_VOUCHER_VOUCHERS_GETBYNUMBER, { path: { number } }, { signal }));
  }

  async timeline(context: ConsoleContext, voucher: string, cursor?: string, signal?: AbortSignal): Promise<VoucherTimeline> {
    return this.mapper.timeline(await this.request(context, Operation.OP_VOUCHER_VOUCHERS_TIMELINE, { path: { voucherid: voucher }, query: { limit: 100, ...(cursor ? { cursor } : {}) } }, { signal }));
  }

  async progress(context: ConsoleContext, kind: VoucherProgressKind, id: string, signal?: AbortSignal): Promise<VoucherProgress> {
    const operation = kind === 'job' ? Operation.OP_VOUCHER_JOBS_GET : kind === 'export' ? Operation.OP_VOUCHER_EXPORTS_GET : kind === 'issue' ? Operation.OP_VOUCHER_ISSUEBATCHES_GET : Operation.OP_VOUCHER_ACTIONBATCHES_GET;
    const key = kind === 'job' ? 'jobid' : kind === 'export' ? 'exportid' : kind === 'issue' ? 'batchid' : 'actionbatchid';
    return this.mapper.progress(kind, await this.request(context, operation, { path: { [key]: id } }, { signal }));
  }

  async execute(context: ConsoleContext, command: VoucherCommand, signal?: AbortSignal): Promise<VoucherReceipt> {
    const value = await this.request(context, command.operation, command.input, { ...command.options, signal });
    return this.mapper.receipt(command.operation, value);
  }

  private request(context: ConsoleContext, operation: VoucherOperation, input: VoucherCommandInput, options: VoucherExecutionOptions = {}): Promise<unknown> {
    const read = voucherReadOperations.has(operation);
    if (!read && !options.identity) throw new Error('VOUCHER_IDEMPOTENCY_REQUIRED');
    const request = read
      ? consoleRequest(context.scope, options.signal, context.session.accessVersion)
      : consoleCommand(context.scope, {
          accessVersion: context.session.accessVersion,
          ...(context.session.csrf ? { csrfToken: context.session.csrf } : {}),
          ...(options.signal ? { signal: options.signal } : {}),
          idempotencyKey: options.identity!,
          ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
          ...(options.proof ? { proof: options.proof } : {}),
        });
    return this.invoke(operation, input, request);
  }

  private invoke(operation: VoucherOperation, input: VoucherCommandInput, request: RequestContext): Promise<unknown> {
    const method = this.client[VOUCHER_METHOD_BY_OPERATION[operation]] as unknown as VoucherInvoker;
    return method(input as never, request);
  }
}
