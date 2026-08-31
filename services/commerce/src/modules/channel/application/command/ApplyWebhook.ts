import { createHash, randomUUID } from 'node:crypto';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export class ApplyWebhook {
  constructor(
    private readonly pool: DatabasePool,
    private readonly kms: KmsClient,
    private readonly audit: AuditSink
  ) {}

  async execute(request: OperationRequest): Promise<OperationResult> {
    const connection = required(request.input.path.connectionid, 'CHANNEL_WEBHOOK_CONNECTION_REQUIRED');
    const context = await this.pool.query<Connection>('select provider,scope_id,status from channel.webhook_context($1)', [connection]);
    const target = context.rows[0];
    if (!target || target.status !== 'enabled') throw new Error('CHANNEL_WEBHOOK_CONNECTION_UNAVAILABLE');
    const declaredLength = Number(request.input.headers['content-length'] ?? 0);
    if ((Number.isFinite(declaredLength) && declaredLength > 1024 * 1024) || Buffer.byteLength(request.input.rawBody) > 1024 * 1024) throw new Error('CHANNEL_WEBHOOK_BODY_TOO_LARGE');
    const external = required(request.input.headers['x-provider-event-id'], 'CHANNEL_WEBHOOK_EVENT_ID_REQUIRED', 255);
    const receivedAt = new Date().toISOString();
    const trace = request.input.headers['x-trace-id'] ?? request.input.headers['x-request-id'] ?? `webhook:${randomUUID()}`;
    const providerRequest = { headers: request.input.headers, body: request.input.rawBody, receivedAt };
    const encrypted = await this.kms.encrypt('evidence', 'channel/webhook', JSON.stringify(providerRequest), { connection, provider: target.provider, scope: target.scope_id, external });
    const rawHash = digest(request.input.rawBody);
    const signatureHash = digest(request.input.headers['x-provider-signature'] ?? '');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyApiDatabaseContext(client, { tenant: '', membership: '', scope: target.scope_id, actor: `provider:${target.provider}`, trace });
      const accepted = await client.query<{ id: string; state: string; replayed: boolean }>(
        `select id,state,replayed from channel.accept_webhook(
        $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
        [connection, external, 'pending', null, '{}', encrypted.ciphertext, encrypted.keyVersion, rawHash, signatureHash, receivedAt, trace]
      );
      const inbox = accepted.rows[0];
      if (!inbox) throw new Error('CHANNEL_WEBHOOK_ACCEPT_FAILED');
      await this.audit.record(client, {
        scope: target.scope_id,
        actor: `provider:${target.provider}`,
        actorType: 'provider',
        action: 'channel.webhooks.receive',
        resourceType: 'channel',
        resource: inbox.id,
        before: { connection, external },
        after: { id: inbox.id, state: inbox.state, replayed: inbox.replayed },
        evidence: { reason: 'provider webhook', rawHash, signatureHash, keyVersion: encrypted.keyVersion },
        trace,
      });
      await client.query('commit');
      return { status: inbox.replayed ? 200 : 202, body: { webhook: inbox.id, state: inbox.state, replayed: inbox.replayed } };
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

interface Connection {
  readonly provider: string;
  readonly scope_id: string;
  readonly status: string;
}
function required(value: string | null | undefined, code: string, maximum = 255): string {
  if (!value?.trim() || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
