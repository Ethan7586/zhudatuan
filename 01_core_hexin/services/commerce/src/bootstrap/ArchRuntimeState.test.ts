import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ArchBoard, type ArchConnection } from '@shop/l-kernel/arch';
import { afterEach, describe, expect, it } from 'vitest';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { bootstrapApi } from './ApiBootstrap';
import { ArchRuntimeState, L_ARCH_STATE_VERSION, readArchRuntimeState } from './ArchRuntimeState';
import { ExtensionRegistry } from './ExtensionRegistry';
import type { CommerceModule } from './ModuleRegistry';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Arch runtime state', () => {
  it('restores after restart and converges multiple API processes on the same revision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'l-arch-state-'));
    roots.push(root);
    const path = join(root, 'state.json');
    await save(path, 1, [connection('disconnected')]);
    const initial = await readArchRuntimeState(path);
    expect(initial?.revision).toBe(1);

    const first = new ArchBoard(initial?.connections);
    const second = new ArchBoard(initial?.connections);
    const firstRuntime = new ArchRuntimeState(path, first, initial);
    const secondRuntime = new ArchRuntimeState(path, second, initial);
    firstRuntime.registerDefaults(['node:l0'], ['member.read']);
    secondRuntime.registerDefaults(['node:l0'], ['member.read']);
    firstRuntime.registerDefaults(['node:l0'], ['GET /api/v1/catalog/public/products']);
    secondRuntime.registerDefaults(['node:l0'], ['GET /api/v1/catalog/public/products']);
    expect(first.state('node:l0', 'member.read')).toBe('disconnected');
    expect(second.state('node:l0', 'member.read')).toBe('disconnected');

    await save(path, 2, [connection('connected')]);
    await Promise.all([firstRuntime.refresh(), secondRuntime.refresh()]);
    expect(firstRuntime.revision).toBe(2);
    expect(secondRuntime.revision).toBe(2);
    expect(first.state('node:l0', 'member.read')).toBe('connected');
    expect(second.state('node:l0', 'member.read')).toBe('connected');
    expect(first.state('node:l0', 'GET /api/v1/catalog/public/products')).toBe('connected');
    expect(second.state('node:l0', 'GET /api/v1/catalog/public/products')).toBe('connected');

    await save(path, 3, [connection('removed')]);
    await Promise.all([firstRuntime.refresh(), secondRuntime.refresh()]);
    expect(first.state('node:l0', 'member.read')).toBe('removed');
    expect(second.state('node:l0', 'member.read')).toBe('removed');

    const restartedState = await readArchRuntimeState(path);
    const restarted = new ArchBoard(restartedState?.connections);
    restarted.mountAll(['node:l0'], ['member.read']);
    expect(restarted.state('node:l0', 'member.read')).toBe('removed');

    await save(path, 4, []);
    await Promise.all([firstRuntime.refresh(), secondRuntime.refresh()]);
    expect(first.state('node:l0', 'member.read')).toBe('connected');
    expect(second.state('node:l0', 'member.read')).toBe('connected');
  });

  it('rejects duplicate connection keys instead of applying an ambiguous snapshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'l-arch-state-invalid-'));
    roots.push(root);
    const path = join(root, 'state.json');
    await save(path, 1, [connection('connected'), connection('disconnected')]);
    await expect(readArchRuntimeState(path)).rejects.toThrow('L_ARCH_CONNECTION_DUPLICATE');
  });

  it('keeps the active switch state when a stale host revision appears', async () => {
    const root = await mkdtemp(join(tmpdir(), 'l-arch-state-stale-'));
    roots.push(root);
    const path = join(root, 'state.json');
    await save(path, 2, [connection('connected')]);
    const initial = await readArchRuntimeState(path);
    const board = new ArchBoard(initial?.connections);
    const runtime = new ArchRuntimeState(path, board, initial);
    runtime.registerDefaults(['node:l0'], ['member.read']);

    await save(path, 1, [connection('disconnected')]);
    await expect(runtime.refresh()).rejects.toThrow('L_ARCH_STATE_REVISION_REGRESSION:2:1');
    expect(runtime.revision).toBe(2);
    expect(board.state('node:l0', 'member.read')).toBe('connected');
  });

  it('observes an atomically created host state file without restarting the API process', async () => {
    const root = await mkdtemp(join(tmpdir(), 'l-arch-state-watch-'));
    roots.push(root);
    const path = join(root, 'state.json');
    const board = new ArchBoard();
    const runtime = new ArchRuntimeState(path, board, null);
    runtime.registerDefaults(['node:l0'], ['member.read']);
    runtime.start();
    try {
      await save(path, 1, [connection('disconnected')]);
      for (let attempt = 0; attempt < 40 && runtime.revision !== 1; attempt += 1) await delay(50);
      expect(runtime.revision).toBe(1);
      expect(board.state('node:l0', 'member.read')).toBe('disconnected');
    } finally {
      await runtime.close();
    }
  });

  it('drives the real API bootstrap from the shared host revision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'l-arch-bootstrap-state-'));
    roots.push(root);
    const path = join(root, 'state.json');
    await save(path, 1, [{ nodeId: 'unresolved', interfaceId: 'support.cases.read', state: 'disconnected' }]);
    let calls = 0;
    const module: CommerceModule = {
      id: 'arch-runtime-state-bootstrap-test', dependencies: [],
      register({ routes }) {
        routes.register({ operation: 'support.cases.read', handler: async () => {
          calls += 1;
          return { status: 200, body: { ok: true } };
        } });
      },
    };
    const bootstrapped = await bootstrapApi({
      modules: [module], operationIds: ['support.cases.read'], archStatePath: path,
      extensions: new ExtensionRegistry({ verify: async () => true } as never),
      allowedOrigins: [], telemetry: commerceTelemetry(),
    });
    try {
      const request = () => bootstrapped.app.handle(new Request('http://127.0.0.1/api/v1/support/cases'));
      expect((await request()).status).toBe(404);
      expect(calls).toBe(0);
      await save(path, 2, [{ nodeId: 'unresolved', interfaceId: 'support.cases.read', state: 'connected' }]);
      await bootstrapped.archState?.refresh();
      expect((await request()).status).toBe(200);
      expect(calls).toBe(1);
    } finally {
      await bootstrapped.archState?.close();
    }
  });
});

function connection(state: ArchConnection['state']): ArchConnection {
  return { nodeId: 'node:l0', interfaceId: 'member.read', state };
}

async function save(path: string, revision: number, connections: readonly ArchConnection[]): Promise<void> {
  await writeFile(path, `${JSON.stringify({
    schema_version: L_ARCH_STATE_VERSION,
    revision,
    updated_at: new Date(revision * 1_000).toISOString(),
    connections,
  })}\n`, 'utf8');
}
