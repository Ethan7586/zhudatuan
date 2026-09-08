import { createClient, type RedisClientType } from 'redis';
import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { EventStream, StreamEntry } from './EventStream';

export class RedisEventStream implements EventStream {
  private client: RedisClientType | undefined;
  constructor(
    private readonly connection: () => Promise<string>,
    private readonly maximumLength = RUNTIME_LIMITS.stream.retentionEvents
  ) {}

  async start(): Promise<void> {
    const url = await this.connection();
    if (!/^rediss?:\/\//.test(url)) throw new Error('REDIS_STREAM_CONNECTION_INVALID');
    const client = createClient({ url, socket: { connectTimeout: RUNTIME_LIMITS.external.connectionTimeoutMilliseconds, reconnectStrategy: false } });
    client.on('error', () => undefined);
    await client.connect();
    this.client = client as RedisClientType;
  }

  async append(stream: string, value: string): Promise<string> {
    if (!this.client?.isReady) throw new Error('SUPPORT_STREAM_UNAVAILABLE');
    const id = await this.client.sendCommand(['XADD', key(stream), 'MAXLEN', '~', String(this.maximumLength), '*', 'event', value]);
    if (typeof id !== 'string') throw new Error('SUPPORT_STREAM_APPEND_FAILED');
    return id;
  }

  async validate(streams: readonly string[], cursor: string | null): Promise<void> {
    if (!this.client?.isReady) throw new Error('SUPPORT_STREAM_UNAVAILABLE');
    const names = streamNames(streams);
    if (cursor === null) return;
    if (!/^\d+-\d+$/.test(cursor)) throw new Error('EVENT_STREAM_CURSOR_EXPIRED');
    await assertRetained(this.client, names, cursor);
  }

  async *read(streams: readonly string[], cursor: string | null, signal: AbortSignal): AsyncIterable<StreamEntry> {
    if (!this.client?.isReady) throw new Error('SUPPORT_STREAM_UNAVAILABLE');
    const names = streamNames(streams);
    const position = cursor ?? '$';
    if (cursor !== null && !/^\d+-\d+$/.test(cursor)) throw new Error('EVENT_STREAM_CURSOR_EXPIRED');
    const reader = this.client.duplicate() as RedisClientType;
    const abort = () => reader.destroy();
    signal.addEventListener('abort', abort, { once: true });
    try {
      await reader.connect();
      if (cursor !== null) await assertRetained(reader, names, cursor);
      let offsets = names.map(() => position);
      while (!signal.aborted) {
        const raw = await reader.sendCommand(['XREAD', 'BLOCK', String(RUNTIME_LIMITS.stream.blockMilliseconds), 'COUNT', String(RUNTIME_LIMITS.stream.readBatch), 'STREAMS', ...names, ...offsets]);
        if (raw === null) continue;
        for (const entry of parse(raw)) {
          const index = names.indexOf(entry.stream);
          if (index >= 0) offsets[index] = entry.id;
          yield Object.freeze({ ...entry, stream: entry.stream.replace(/^support:/, '') });
        }
      }
    } catch (cause) {
      if (!signal.aborted) throw cause;
    } finally {
      signal.removeEventListener('abort', abort);
      if (reader.isOpen) await reader.close().catch(() => reader.destroy());
    }
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client?.isOpen) await client.close().catch(() => client.destroy());
  }
}

function key(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9:.-]{0,255}$/.test(value)) throw new Error('SUPPORT_STREAM_KEY_INVALID');
  return `support:${value}`;
}

function streamNames(streams: readonly string[]): string[] {
  const names = [...new Set(streams)].map(key);
  if (names.length === 0 || names.length > 100) throw new Error('SUPPORT_STREAM_SCOPE_INVALID');
  return names;
}

async function assertRetained(client: RedisClientType, streams: readonly string[], cursor: string): Promise<void> {
  for (const stream of streams) {
    const raw = await client.sendCommand(['XRANGE', stream, '-', '+', 'COUNT', '1']);
    const first = Array.isArray(raw) && Array.isArray(raw[0]) ? raw[0][0] : null;
    if (typeof first === 'string' && compare(first, cursor) > 0) throw new Error('EVENT_STREAM_CURSOR_EXPIRED');
  }
}

function compare(left: string, right: string): number {
  const [lm, ls] = left.split('-').map(BigInt);
  const [rm, rs] = right.split('-').map(BigInt);
  return lm! < rm! ? -1 : lm! > rm! ? 1 : ls! < rs! ? -1 : ls! > rs! ? 1 : 0;
}

function parse(value: unknown): Array<{ id: string; stream: string; value: string }> {
  if (!Array.isArray(value)) throw new Error('SUPPORT_STREAM_RESPONSE_INVALID');
  const output: Array<{ id: string; stream: string; value: string }> = [];
  for (const stream of value) {
    if (!Array.isArray(stream) || typeof stream[0] !== 'string' || !Array.isArray(stream[1])) throw new Error('SUPPORT_STREAM_RESPONSE_INVALID');
    for (const entry of stream[1]) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string' || !Array.isArray(entry[1])) throw new Error('SUPPORT_STREAM_RESPONSE_INVALID');
      const fields = entry[1];
      const index = fields.indexOf('event');
      if (index < 0 || typeof fields[index + 1] !== 'string') throw new Error('SUPPORT_STREAM_RESPONSE_INVALID');
      output.push({ id: entry[0], stream: stream[0], value: fields[index + 1] });
    }
  }
  return output;
}
