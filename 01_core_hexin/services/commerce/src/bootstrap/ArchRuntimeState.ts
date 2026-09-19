import { readFile } from 'node:fs/promises';
import { unwatchFile, watchFile } from 'node:fs';
import { ArchBoard, type ArchConnection } from '@shop/l-kernel/arch';

export const L_ARCH_STATE_VERSION = 'l-arch-state.v1' as const;
export const DEFAULT_L_ARCH_STATE_PATH = '/var/lib/l-arch/state.json' as const;

export interface ArchRuntimeStateDocument {
  readonly schema_version: typeof L_ARCH_STATE_VERSION;
  readonly revision: number;
  readonly updated_at: string;
  readonly connections: readonly ArchConnection[];
}

export function configuredArchStatePath(): string | undefined {
  const configured = process.env.L_ARCH_STATE_PATH?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? DEFAULT_L_ARCH_STATE_PATH : undefined;
}

export async function readArchRuntimeState(path: string): Promise<ArchRuntimeStateDocument | null> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return null;
    throw cause;
  }
  return parseArchRuntimeState(JSON.parse(source) as unknown);
}

export class ArchRuntimeState {
  private appliedRevision: number | null;
  private connections: readonly ArchConnection[];
  private readonly defaults = new Map<string, ArchConnection>();
  private queue: Promise<void> = Promise.resolve();
  private watching = false;

  constructor(
    readonly path: string,
    private readonly board: ArchBoard,
    initial: ArchRuntimeStateDocument | null,
  ) {
    this.appliedRevision = initial?.revision ?? null;
    this.connections = initial?.connections ?? board.snapshot();
    this.apply();
  }

  get revision(): number | null { return this.appliedRevision; }

  registerDefaults(nodeIds: readonly string[], interfaceIds: readonly string[]): void {
    for (const nodeId of nodeIds) {
      for (const interfaceId of interfaceIds) {
        const connection = Object.freeze({ nodeId, interfaceId, state: 'connected' as const });
        this.defaults.set(JSON.stringify([nodeId, interfaceId]), connection);
      }
    }
    this.apply();
  }

  start(): this {
    if (this.watching) return this;
    this.watching = true;
    watchFile(this.path, { interval: 500, persistent: false }, () => {
      this.queue = this.queue.then(() => this.refresh()).catch((cause) => {
        console.warn(`L_ARCH_STATE_REFRESH_FAILED:${message(cause)}`);
      });
    });
    return this;
  }

  async refresh(): Promise<void> {
    const document = await readArchRuntimeState(this.path);
    if (document === null || document.revision === this.appliedRevision) return;
    if (this.appliedRevision !== null && document.revision < this.appliedRevision) {
      throw new Error(`L_ARCH_STATE_REVISION_REGRESSION:${this.appliedRevision}:${document.revision}`);
    }
    this.connections = document.connections;
    this.appliedRevision = document.revision;
    this.apply();
  }

  async close(): Promise<void> {
    if (this.watching) unwatchFile(this.path);
    this.watching = false;
    await this.queue;
  }

  private apply(): void {
    this.board.replace([...this.defaults.values(), ...this.connections]);
  }
}

function parseArchRuntimeState(value: unknown): ArchRuntimeStateDocument {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('L_ARCH_STATE_INVALID');
  const candidate = value as Record<string, unknown>;
  if (candidate.schema_version !== L_ARCH_STATE_VERSION) throw new Error('L_ARCH_STATE_VERSION_INVALID');
  if (!Number.isSafeInteger(candidate.revision) || Number(candidate.revision) < 1) throw new Error('L_ARCH_STATE_REVISION_INVALID');
  if (typeof candidate.updated_at !== 'string' || Number.isNaN(Date.parse(candidate.updated_at))) {
    throw new Error('L_ARCH_STATE_UPDATED_AT_INVALID');
  }
  if (!Array.isArray(candidate.connections)) throw new Error('L_ARCH_STATE_CONNECTIONS_INVALID');
  const seen = new Set<string>();
  const connections = candidate.connections.map((connection) => parseConnection(connection, seen));
  return Object.freeze({
    schema_version: L_ARCH_STATE_VERSION,
    revision: Number(candidate.revision),
    updated_at: candidate.updated_at,
    connections: Object.freeze(connections),
  });
}

function parseConnection(value: unknown, seen: Set<string>): ArchConnection {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('L_ARCH_CONNECTION_INVALID');
  const candidate = value as Record<string, unknown>;
  const nodeId = identifier(candidate.nodeId, 'L_ARCH_NODE_ID_INVALID');
  const interfaceId = identifier(candidate.interfaceId, 'L_ARCH_INTERFACE_ID_INVALID');
  if (!['connected', 'disconnected', 'removed'].includes(String(candidate.state))) throw new Error('L_ARCH_CONNECTION_STATE_INVALID');
  const key = JSON.stringify([nodeId, interfaceId]);
  if (seen.has(key)) throw new Error('L_ARCH_CONNECTION_DUPLICATE');
  seen.add(key);
  return Object.freeze({ nodeId, interfaceId, state: candidate.state as ArchConnection['state'] });
}

function identifier(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > 240) throw new Error(code);
  return value;
}

function errorCode(cause: unknown): string | undefined {
  return cause !== null && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
