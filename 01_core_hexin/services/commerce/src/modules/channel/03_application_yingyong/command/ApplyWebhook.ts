import { createHash, randomUUID } from 'node:crypto';
import type { AuditSink } from '../../../../foundation/application/AuditSink';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { WebhookResolver } from '../port/WebhookResolver';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export class ApplyWebhook {
  constructor(private readonly pool: DatabasePool, private readonly kms: KmsClient, private readonly webhooks: WebhookResolver,
    private readonly audit: AuditSink) {}

  async execute(request: OperationRequest): Promise<OperationResult> {
    const connection = required(request.input.path.connectionid, 'CHANNEL_WEBHOOK_CONNECTION_REQUIRED');
    const context = await this.pool.query<Connection>('select * from channel.webhook_context($1)', [connection]);
    const target = context.rows[0];
    if (!target) throw new Error('CHANNEL_WEBHOOK_CONNECTION_UNAVAILABLE');
    const external = required(request.input.headers['x-provider-event-id'], 'CHANNEL_WEBHOOK_EVENT_ID_REQUIRED', 255);
    const receivedAt = new Date().toISOString();
    const trace = request.input.headers['x-trace-id'] ?? request.input.headers['x-request-id'] ?? `webhook:${randomUUID()}`;
    const port = this.webhooks.resolve(target.provider, target.scope_id);
    const providerRequest = { headers: request.input.headers, body: request.input.rawBody, receivedAt };
    if (!await port.verify({ tenantId: target.scope_id,requestId: external,traceId: trace,
      idempotencyKey: external,deadline: request.input.deadline }, providerRequest)) throw new Error('PROVIDER_WEBHOOK_SIGNATURE_INVALID');
    const normalized = port.normalize(providerRequest);
    const event = required(string(normalized.eventType) ?? string(normalized.type), 'CHANNEL_WEBHOOK_EVENT_TYPE_REQUIRED', 100);
    const reference = optional(string(normalized.externalReference) ?? string(normalized.reference), 255);
    const encrypted = await this.kms.encrypt('channel/webhook', request.input.rawBody,
      { connection, provider: target.provider, scope: target.scope_id, external });
    const rawHash = digest(request.input.rawBody);
    const signatureHash = digest(request.input.headers['x-provider-signature'] ?? '');
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyApiDatabaseContext(client, { tenant: '', membership: '', scope: target.scope_id,
        actor: `provider:${target.provider}`, trace });
      const accepted = await client.query<{ id: string; state: string; replayed: boolean }>(`select * from channel.accept_webhook(
        $1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`, [connection, external, event, reference, JSON.stringify(normalized),
        encrypted.ciphertext, encrypted.keyVersion, rawHash, signatureHash, receivedAt, trace]);
      const inbox = accepted.rows[0];
      if (!inbox) throw new Error('CHANNEL_WEBHOOK_ACCEPT_FAILED');
      await this.audit.record(client,{ scope:target.scope_id, actor:`provider:${target.provider}`, actorType:'provider',
        action:'channel.webhooks.receive', resourceType:'channel', resource:inbox.id,
        before:{ connection, external, event, reference, normalized }, after:{ id:inbox.id, state:inbox.state, replayed:inbox.replayed },
        evidence:{ reason:'provider webhook', rawHash, signatureHash, keyVersion:encrypted.keyVersion }, trace });
      await client.query('commit');
      return { status:inbox.replayed ? 200 : 202, body:{ webhook:inbox.id, state:inbox.state, replayed:inbox.replayed } };
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

interface Connection { readonly provider: string; readonly scope_id: string; readonly status: string }
function required(value: string | null | undefined, code: string, maximum = 255): string {
  if (!value?.trim() || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}
function optional(value: string | null, maximum: number): string | null {
  if (value === null) return null;
  if (!value.trim() || value.trim().length > maximum) throw new Error('CHANNEL_WEBHOOK_REFERENCE_INVALID');
  return value.trim();
}
function string(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
