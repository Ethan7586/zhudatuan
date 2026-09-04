import { createFetchVoucher } from '@shop/sdk/voucher';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { VoucherProgramDraft, VoucherView } from '../model/Voucher';
import type { VoucherPort } from '../public';
import { VoucherMapper } from './VoucherMapper';

export class VoucherGateway implements VoucherPort {
  private readonly client;

  constructor(
    baseUrl: string,
    private readonly mapper = new VoucherMapper()
  ) {
    this.client = createFetchVoucher(baseUrl);
  }

  async read(context: ConsoleContext, view: VoucherView, cursor?: string, signal?: AbortSignal) {
    const input = { query: { limit: 50, ...(cursor ? { cursor } : {}) } };
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    if (view === 'libraries') return this.mapper.page(view, await this.client.cardlibrariesRead(input, request));
    if (view === 'programs') return this.mapper.page(view, await this.client.programsRead(input, request));
    if (view === 'reserves') return this.mapper.page(view, await this.client.reservesRead(input, request));
    if (view === 'batches') return this.mapper.page(view, await this.client.batchesRead(input, request));
    if (view === 'statusbatches') return this.mapper.page(view, await this.client.statusbatchesRead(input, request));
    if (view === 'bindings') return this.mapper.page(view, await this.client.bindingsRead(input, request));
    if (view === 'redemptions') return this.mapper.page(view, await this.client.redemptionsRead(input, request));
    return this.mapper.page(view, await this.client.historyRead(input, request));
  }

  async createLibrary(context: ConsoleContext, prefix: string, identity: string, signal?: AbortSignal): Promise<void> {
    await this.client.cardlibrariesCreate({ body: { mode: 'generated', prefix, provider: null } }, this.command(context, { signal, identity }));
  }

  async allocateLibrary(context: ConsoleContext, input: Readonly<{ library: string; version: number; scope: string; count: number; proof: string; identity: string }>, signal?: AbortSignal): Promise<void> {
    await this.client.cardlibrariesAllocate(
      { path: { libraryid: input.library }, body: { scope: input.scope, count: input.count } },
      this.command(context, { signal, expectedVersion: input.version, proof: input.proof, identity: input.identity })
    );
  }

  async saveProgram(context: ConsoleContext, draft: VoucherProgramDraft, identity: string, signal?: AbortSignal): Promise<void> {
    const id = draft.id ?? `voucher-program:${crypto.randomUUID()}`;
    await this.client.programsManage(
      { path: { programid: id }, body: { name: draft.name, valueMinor: draft.valueMinor, validityDays: draft.validityDays, status: draft.status, approvalRequired: draft.approvalRequired } },
      this.command(context, { signal, identity, ...(draft.version === undefined ? {} : { expectedVersion: draft.version }) })
    );
  }

  async requestReserve(context: ConsoleContext, input: Readonly<{ program: string; count: number; reason: string; identity: string }>, signal?: AbortSignal): Promise<void> {
    await this.client.reservesRequest({ body: { program: input.program, count: input.count, reason: input.reason } }, this.command(context, { signal, identity: input.identity }));
  }

  async decideReserve(context: ConsoleContext, input: Readonly<{ reserve: string; version: number; decision: 'approved' | 'rejected'; reason: string; proof: string; identity: string }>, signal?: AbortSignal): Promise<void> {
    await this.client.reservesDecide(
      { path: { reserveid: input.reserve }, body: { decision: input.decision, reason: input.reason } },
      this.command(context, { signal, expectedVersion: input.version, proof: input.proof, identity: input.identity })
    );
  }

  async issueBatch(context: ConsoleContext, input: Readonly<{ program: string; version: number; cardpool: string; count: number; reserve?: string; proof: string; identity: string }>, signal?: AbortSignal): Promise<void> {
    await this.client.batchesIssue(
      { body: { program: input.program, cardpool: input.cardpool, count: input.count, ...(input.reserve ? { reserve: input.reserve } : {}) } },
      this.command(context, { signal, expectedVersion: input.version, proof: input.proof, identity: input.identity })
    );
  }

  async retryBatch(context: ConsoleContext, input: Readonly<{ batch: string; version: number; proof: string; identity: string }>, signal?: AbortSignal): Promise<void> {
    await this.client.batchesRetry({ path: { batchid: input.batch }, body: {} }, this.command(context, { signal, expectedVersion: input.version, proof: input.proof, identity: input.identity }));
  }

  async changeStatus(
    context: ConsoleContext,
    input: Readonly<{ ids: readonly string[]; version: number; action: 'activate' | 'disable' | 'extend' | 'void'; reason: string; expiresAt?: string; proof: string; identity: string }>,
    signal?: AbortSignal
  ): Promise<void> {
    await this.client.statusBatch(
      { body: { ids: [...input.ids], action: input.action, reason: input.reason, ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}) } },
      this.command(context, { signal, expectedVersion: input.version, proof: input.proof, identity: input.identity })
    );
  }

  async bind(context: ConsoleContext, input: Readonly<{ voucher: string; version: number; member: string; reason: string; identity: string }>, signal?: AbortSignal): Promise<void> {
    await this.client.bindingsManage({ path: { voucherid: input.voucher }, body: { member: input.member, reason: input.reason } }, this.command(context, { signal, expectedVersion: input.version, identity: input.identity }));
  }

  async reverse(context: ConsoleContext, input: Readonly<{ redemption: string; version: number; reason: string; proof: string; identity: string }>, signal?: AbortSignal): Promise<void> {
    await this.client.redemptionsReverse({ path: { redemptionid: input.redemption }, body: { reason: input.reason } }, this.command(context, { signal, expectedVersion: input.version, proof: input.proof, identity: input.identity }));
  }

  private command(context: ConsoleContext, options: Readonly<{ signal?: AbortSignal | undefined; expectedVersion?: number; proof?: string; identity: string }>) {
    return consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      idempotencyKey: options.identity,
      ...(context.session.csrf ? { csrfToken: context.session.csrf } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
      ...(options.proof ? { proof: options.proof } : {}),
    });
  }
}
