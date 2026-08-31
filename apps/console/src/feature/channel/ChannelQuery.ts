import { createFetchChannelConnectionsRead, createFetchChannelOperationsRead, createFetchChannelSyncrunsRead } from '@shop/sdk/channel';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ChannelConnectionPageSchema, ChannelOperationPageSchema, ChannelSyncPageSchema, type ChannelRecordPage, type ChannelView } from './ChannelSchema';

const connectionsRead = createFetchChannelConnectionsRead(appConfig.apiBaseUrl);
const syncrunsRead = createFetchChannelSyncrunsRead(appConfig.apiBaseUrl);
const operationsRead = createFetchChannelOperationsRead(appConfig.apiBaseUrl);

export const channelViews = ['connections', 'syncs', 'operations'] as const;
export const channelKey = (context: ConsoleContext, view: ChannelView, cursor?: string) =>
  Object.freeze([
    'console',
    context.scope.kind,
    context.scope.id,
    context.session.accessVersion,
    view === 'connections' ? 'channel.connections.read' : view === 'syncs' ? 'channel.syncruns.read' : 'channel.operations.read',
    cursor ?? null,
    50,
  ] as const);
export async function readChannels(context: ConsoleContext, view: ChannelView, cursor: string | undefined, signal: AbortSignal): Promise<ChannelRecordPage> {
  const input = { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } };
  const request = consoleRequest(context.scope, signal, context.session.accessVersion);
  if (view === 'connections') {
    const page = ChannelConnectionPageSchema.parse(await connectionsRead(input, request));
    return pageResult(
      page.items.map((row) => ({
        id: row.id,
        provider: row.provider,
        kind: row.contract_version,
        state: row.status,
        progress: `并发 ${row.max_concurrency} · 重试 ${row.max_attempts} · 熔断 ${row.failure_threshold}`,
        reference: `${row.region} · ${row.has_secret ? '凭据已配置' : '凭据未配置'}`,
        occurredAt: row.updated_at,
        version: row.version,
      })),
      page
    );
  }
  if (view === 'syncs') {
    const page = ChannelSyncPageSchema.parse(await syncrunsRead(input, request));
    return pageResult(
      page.items.map((row) => ({
        id: row.id,
        provider: row.connection_id,
        kind: row.kind,
        state: row.state,
        progress: `拉取 ${row.pulled_count} · 接受 ${row.accepted_count} · 拒绝 ${row.rejected_count}`,
        reference: row.watermark ?? '无水位',
        occurredAt: row.completed_at ?? row.started_at,
        version: null,
      })),
      page
    );
  }
  const page = ChannelOperationPageSchema.parse(await operationsRead(input, request));
  return pageResult(
    page.items.map((row) => ({ id: row.id, provider: row.provider, kind: row.kind, state: row.state, progress: row.internal_reference, reference: row.external_reference ?? '无外部回执', occurredAt: row.updated_at, version: null })),
    page
  );
}

function pageResult(items: ChannelRecordPage['items'], page: Readonly<{ count: number; nextCursor?: string | undefined }>): ChannelRecordPage {
  return Object.freeze({ items: Object.freeze(items), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
}
