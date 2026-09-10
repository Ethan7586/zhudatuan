import type { ChannelPage, ChannelView } from '../model/Channel';
import { ChannelConnectionPageSchema, ChannelOperationPageSchema, ChannelSyncPageSchema } from './ChannelSchema';

export class ChannelMapper {
  page(view: ChannelView, value: unknown): ChannelPage {
    if (view === 'connections') {
      const page = ChannelConnectionPageSchema.parse(value);
      return result(
        page.items.map((row) =>
          Object.freeze({
            type: 'connection' as const,
            id: row.id,
            provider: row.provider,
            scope: row.scope_id,
            state: row.status,
            contractVersion: row.contract_version,
            region: row.region,
            limits: Object.freeze({
              connectionTimeoutMs: row.connection_timeout_ms,
              responseTimeoutMs: row.response_timeout_ms,
              totalDeadlineMs: row.total_deadline_ms,
              maxConcurrency: row.max_concurrency,
              requestsPerSecond: row.requests_per_second,
              maxAttempts: row.max_attempts,
              failureThreshold: row.failure_threshold,
              recoveryMs: row.recovery_ms,
            }),
            version: row.version,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            hasSecret: row.has_secret,
            capabilities: Object.freeze(row.capabilities ?? []),
            health: Object.freeze({ state: row.health_state ?? null, latencyMs: row.health_latency_ms ?? null, reason: row.health_reason ?? null, checkedAt: row.checked_at ?? null }),
          })
        ),
        page
      );
    }
    if (view === 'syncs') {
      const page = ChannelSyncPageSchema.parse(value);
      return result(
        page.items.map((row) =>
          Object.freeze({
            type: 'sync' as const,
            id: row.id,
            connection: row.connection_id,
            provider: row.provider,
            region: row.region,
            kind: row.kind,
            state: row.state,
            cursor: row.cursor_value,
            inputHash: row.input_hash,
            input: Object.freeze({ ...row.input }),
            errors: Object.freeze([...row.error_summary]),
            watermark: row.watermark,
            pulled: row.pulled_count,
            accepted: row.accepted_count,
            rejected: row.rejected_count,
            startedAt: row.started_at,
            completedAt: row.completed_at,
            version: row.version,
          })
        ),
        page
      );
    }
    const page = ChannelOperationPageSchema.parse(value);
    return result(
      page.items.map((row) =>
        Object.freeze({
          type: 'operation' as const,
          id: row.id,
          provider: row.provider,
          kind: row.kind,
          internalReference: row.internal_reference,
          externalReference: row.external_reference,
          state: row.state,
          response: row.response,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })
      ),
      page
    );
  }
}

function result(items: ChannelPage['items'], page: Readonly<{ count: number; nextCursor?: string | undefined }>): ChannelPage {
  return Object.freeze({ items: Object.freeze(items), count: page.count, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) });
}
