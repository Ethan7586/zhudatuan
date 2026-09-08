import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Operation } from '@shop/contract';

export class PublicActorFingerprint {
  constructor(private readonly key: string) {
    if (Buffer.byteLength(key) < 32) throw new Error('PUBLIC_ACTOR_KEY_INVALID');
  }

  create(operation: Operation, input: Readonly<object>, headers: Readonly<Record<string, string>>): string {
    const target = headers['x-client-target'] ?? 'service';
    const device = bounded(headers['x-device-id'] ?? 'device:missing', 256);
    const network = networkPrefix(headers['x-peer-address'] ?? 'unknown');
    const credential = this.credential(operation.id, input);
    return `public:${createHmac('sha256', this.key)
      .update(JSON.stringify([target, device, network, credential]))
      .digest('hex')}`;
  }

  private credential(operation: string, input: Readonly<object>): string {
    const body = record(Reflect.get(input, 'body'));
    const candidate = firstText(body, ['code', 'subject', 'destination', 'ticket', 'state']) ?? firstText(record(body?.authorization), ['code', 'state', 'nonce']) ?? operation;
    return createHmac('sha256', this.key)
      .update(`${operation}\u001f${bounded(candidate, 4096)}`)
      .digest('hex');
  }
}

function networkPrefix(value: string): string {
  const address = value.split('%', 1)[0] ?? 'unknown';
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1];
  if (mapped && isIP(mapped) === 4) return ipv4Prefix(mapped);
  const family = isIP(address);
  if (family === 4) return ipv4Prefix(address);
  if (family !== 6) return 'unknown';
  const words = ipv6Words(address);
  return words === null
    ? 'unknown'
    : `${words
        .slice(0, 4)
        .map((word) => word.toString(16))
        .join(':')}::/64`;
}

function ipv4Prefix(address: string): string {
  const octets = address.split('.');
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

function ipv6Words(address: string): readonly number[] | null {
  const sections = address.toLowerCase().split('::');
  if (sections.length > 2) return null;
  const left = words(sections[0] ?? '');
  const right = words(sections[1] ?? '');
  if (left === null || right === null) return null;
  const missing = 8 - left.length - right.length;
  if (sections.length === 1 ? missing !== 0 : missing < 1) return null;
  return Object.freeze([...left, ...Array.from({ length: missing }, () => 0), ...right]);
}

function words(value: string): readonly number[] | null {
  if (value.length === 0) return Object.freeze([]);
  const output: number[] = [];
  for (const part of value.split(':')) {
    if (part.includes('.')) {
      if (isIP(part) !== 4) return null;
      const octets = part.split('.').map(Number);
      output.push((octets[0]! << 8) | octets[1]!, (octets[2]! << 8) | octets[3]!);
    } else {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      output.push(Number.parseInt(part, 16));
    }
  }
  return Object.freeze(output);
}

function firstText(value: Readonly<Record<string, unknown>> | null, names: readonly string[]): string | null {
  if (value === null) return null;
  for (const name of names) {
    const candidate = value[name];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate.trim().toLowerCase();
  }
  return null;
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : null;
}

function bounded(value: string, maximum: number): string {
  return value.slice(0, maximum);
}
