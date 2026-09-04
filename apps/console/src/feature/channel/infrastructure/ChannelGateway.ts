import { createFetchChannel } from '@shop/sdk/channel';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { ChannelView, ConnectionDraft, SyncDraft } from '../model/Channel';
import type { ChannelPort } from '../public';
import { ChannelMapper } from './ChannelMapper';

export class ChannelGateway implements ChannelPort {
  private readonly client;
  constructor(
    baseUrl: string,
    private readonly mapper = new ChannelMapper()
  ) {
    this.client = createFetchChannel(baseUrl);
  }
  async read(context: ConsoleContext, view: ChannelView, cursor?: string, signal?: AbortSignal) {
    const input = { query: { limit: 50, ...(cursor ? { cursor } : {}) } };
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    const value = view === 'connections' ? await this.client.connectionsRead(input, request) : view === 'syncs' ? await this.client.syncrunsRead(input, request) : await this.client.operationsRead(input, request);
    return this.mapper.page(view, value);
  }
  async create(context: ConsoleContext, draft: ConnectionDraft, proof: string, identity: string, signal?: AbortSignal) {
    await this.client.connectionsCreate({ body: body(draft) }, command(context, identity, { proof, ...(signal ? { signal } : {}) }));
  }
  async update(context: ConsoleContext, connection: string, version: number, draft: ConnectionDraft, proof: string, identity: string, signal?: AbortSignal) {
    await this.client.connectionsUpdate({ path: { connectionid: connection }, body: body(draft) }, command(context, identity, { proof, expectedVersion: version, ...(signal ? { signal } : {}) }));
  }
  async test(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal) {
    await this.client.connectionsTest({ path: { connectionid: connection }, body: {} }, command(context, identity, { proof, expectedVersion: version, ...(signal ? { signal } : {}) }));
  }
  async enable(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal) {
    await this.client.connectionsEnable({ path: { connectionid: connection }, body: {} }, command(context, identity, { proof, expectedVersion: version, ...(signal ? { signal } : {}) }));
  }
  async disable(context: ConsoleContext, connection: string, version: number, proof: string, identity: string, signal?: AbortSignal) {
    await this.client.connectionsDisable({ path: { connectionid: connection }, body: {} }, command(context, identity, { proof, expectedVersion: version, ...(signal ? { signal } : {}) }));
  }
  async startSync(context: ConsoleContext, draft: SyncDraft, identity: string, signal?: AbortSignal) {
    await this.client.syncrunsStart(
      {
        body: {
          connection: draft.connection,
          kind: draft.kind,
          ...(draft.cursor ? { cursor: draft.cursor } : {}),
          ...(draft.start ? { start: draft.start } : {}),
          ...(draft.end ? { end: draft.end } : {}),
          ...(draft.timezone ? { timezone: draft.timezone } : {}),
          ...(draft.partner ? { partner: draft.partner } : {}),
        },
      },
      command(context, identity, { ...(signal ? { signal } : {}) })
    );
  }
  async cancelSync(context: ConsoleContext, sync: string, version: number, identity: string, signal?: AbortSignal) {
    await this.client.syncrunsCancel({ path: { runid: sync }, body: {} }, command(context, identity, { expectedVersion: version, ...(signal ? { signal } : {}) }));
  }
  async replay(context: ConsoleContext, operation: string, proof: string, identity: string, signal?: AbortSignal) {
    await this.client.operationsReplay({ path: { operationid: operation }, body: {} }, command(context, identity, { proof, ...(signal ? { signal } : {}) }));
  }
}

function body(draft: ConnectionDraft) {
  return { provider: draft.provider, configuration: { region: draft.region, baseUrl: draft.baseUrl ?? null, healthOperation: draft.healthOperation, endpoints: { ...draft.endpoints } }, secretRef: draft.secretRef };
}
function command(context: ConsoleContext, identity: string, options: Readonly<{ proof?: string; expectedVersion?: number; signal?: AbortSignal }>) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: identity,
    ...(context.session.csrf ? { csrfToken: context.session.csrf } : {}),
    ...(options.proof ? { proof: options.proof } : {}),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.signal ? { signal: options.signal } : {}),
  });
}
