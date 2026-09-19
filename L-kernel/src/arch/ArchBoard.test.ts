import { describe, expect, it, vi } from 'vitest';
import { ArchBoard, type ArchConnectionState } from './ArchBoard';

describe('ArchBoard', () => {
  it('mounts one interface, passes data to its owner, and isolates switches by node and interface', async () => {
    const arch = new ArchBoard();
    const owner = vi.fn(async (input: { value: number }) => ({ doubled: input.value * 2 }));
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('unmounted');
    expect(await arch.exchange('node:hbbtzn:l1', 'member.read', { value: 1 }, owner))
      .toEqual({ connected: false });
    arch.mount('node:hbbtzn:l1', 'member.read');
    expect(await arch.exchange('node:hbbtzn:l1', 'member.read', { value: 2 }, owner))
      .toEqual({ connected: true, output: { doubled: 4 } });
    arch.setConnected('node:hbbtzn:l1', 'member.read', false);
    expect(await arch.exchange('node:hbbtzn:l1', 'member.read', { value: 3 }, owner))
      .toEqual({ connected: false });
    expect(arch.state('node:hbbtzn:l1', 'member.write')).toBe('unmounted');
    expect(await arch.exchange('node:hbbtzn:l1', 'member.write', { value: 4 }, owner))
      .toEqual({ connected: false });
    expect(await arch.exchange('node:other:l1', 'member.read', { value: 5 }, owner))
      .toEqual({ connected: false });
    expect(arch.inspect('node:hbbtzn:l1', ['member.read', 'member.write'])).toEqual([
      { nodeId: 'node:hbbtzn:l1', interfaceId: 'member.read', state: 'disconnected' },
      { nodeId: 'node:hbbtzn:l1', interfaceId: 'member.write', state: 'unmounted' },
    ]);
    arch.setConnected('node:hbbtzn:l1', 'member.read', true);
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('connected');
    arch.unmount('node:hbbtzn:l1', 'member.read');
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('removed');
    expect(await arch.exchange('node:hbbtzn:l1', 'member.read', { value: 6 }, owner))
      .toEqual({ connected: false });
    arch.setConnected('node:hbbtzn:l1', 'member.read', true);
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('removed');
    expect(owner).toHaveBeenCalledOnce();
  });

  it('mounts an existing host catalog for every node without resetting disconnected interfaces', () => {
    const arch = new ArchBoard();
    arch.mountAll(['node:l0', 'node:l1'], ['member.read', 'order.read']);
    arch.setConnected('node:l1', 'order.read', false);
    arch.mountAll(['node:l0', 'node:l1', 'node:l2'], ['member.read', 'order.read']);
    expect(arch.state('node:l1', 'order.read')).toBe('disconnected');
    expect(arch.state('node:l0', 'order.read')).toBe('connected');
    expect(arch.state('node:l2', 'member.read')).toBe('connected');
    expect(arch.state('node:l2', 'other.read')).toBe('unmounted');
  });

  it('keeps an explicitly removed interface closed across repeated installs until explicitly mounted', async () => {
    const arch = new ArchBoard();
    const owner = vi.fn(async () => 'ok');
    arch.mountAll(['node:l0', 'node:l1'], ['member.read', 'order.read']);
    arch.unmount('node:l1', 'member.read');
    arch.mountAll(['node:l0', 'node:l1'], ['member.read', 'order.read']);
    expect(arch.inspect('node:l1', ['member.read', 'order.read'])).toEqual([
      { nodeId: 'node:l1', interfaceId: 'member.read', state: 'removed' },
      { nodeId: 'node:l1', interfaceId: 'order.read', state: 'connected' },
    ]);
    expect(await arch.exchange('node:l1', 'member.read', null, owner)).toEqual({ connected: false });
    expect(await arch.exchange('node:l0', 'member.read', null, owner)).toEqual({ connected: true, output: 'ok' });
    arch.mount('node:l1', 'member.read');
    expect(await arch.exchange('node:l1', 'member.read', null, owner)).toEqual({ connected: true, output: 'ok' });
    expect(owner).toHaveBeenCalledTimes(2);
  });

  it('exports stable state and accepts it again without owning its storage', async () => {
    const original = new ArchBoard();
    original.mountAll(['node:l1', 'node:l0'], ['order.read', 'member.read']);
    original.setConnected('node:l1', 'order.read', false);
    original.unmount('node:l0', 'member.read');

    const snapshot = original.snapshot();
    expect(snapshot).toEqual([
      { nodeId: 'node:l0', interfaceId: 'member.read', state: 'removed' },
      { nodeId: 'node:l0', interfaceId: 'order.read', state: 'connected' },
      { nodeId: 'node:l1', interfaceId: 'member.read', state: 'connected' },
      { nodeId: 'node:l1', interfaceId: 'order.read', state: 'disconnected' },
    ]);

    const restored = new ArchBoard(snapshot);
    restored.mountAll(['node:l0', 'node:l1'], ['member.read', 'order.read']);
    expect(restored.snapshot()).toEqual(snapshot);
    expect(await restored.exchange('node:l1', 'order.read', null, async () => 'unexpected'))
      .toEqual({ connected: false });
    expect(await restored.exchange('node:l0', 'order.read', null, async () => 'ok'))
      .toEqual({ connected: true, output: 'ok' });
  });

  it('atomically replaces host-provided state before defaults are installed again', () => {
    const arch = new ArchBoard([
      { nodeId: 'node:l0', interfaceId: 'member.read', state: 'connected' },
      { nodeId: 'node:l1', interfaceId: 'order.read', state: 'disconnected' },
    ]);
    arch.replace([
      { nodeId: 'node:l0', interfaceId: 'member.read', state: 'removed' },
      { nodeId: 'node:l2', interfaceId: 'catalog.read', state: 'connected' },
    ]);

    expect(arch.state('node:l1', 'order.read')).toBe('unmounted');
    expect(arch.state('node:l0', 'member.read')).toBe('removed');
    expect(arch.state('node:l2', 'catalog.read')).toBe('connected');
  });

  it('rejects malformed identifiers and state without partially changing the board', () => {
    const arch = new ArchBoard([
      { nodeId: 'node:l0', interfaceId: 'member.read', state: 'connected' },
    ]);
    const before = arch.snapshot();

    expect(() => arch.replace([
      { nodeId: 'node:l1', interfaceId: 'order.read', state: 'connected' },
      { nodeId: ' node:l2', interfaceId: 'catalog.read', state: 'connected' },
    ])).toThrow('L_ARCH_NODE_ID_INVALID');
    expect(arch.snapshot()).toEqual(before);
    expect(() => arch.replace([
      { nodeId: 'node:l1', interfaceId: 'order.read', state: 'invalid' as ArchConnectionState },
    ])).toThrow('L_ARCH_CONNECTION_STATE_INVALID');
    expect(arch.snapshot()).toEqual(before);
    expect(() => arch.mountAll(['node:l1', ''], ['order.read'])).toThrow('L_ARCH_NODE_ID_INVALID');
    expect(arch.snapshot()).toEqual(before);
    expect(() => arch.mount('node:l1', ' order.read')).toThrow('L_ARCH_INTERFACE_ID_INVALID');
  });

  it('keeps every switch independent across 24 nodes and 40 interfaces', async () => {
    const arch = new ArchBoard();
    const nodeIds = Array.from({ length: 24 }, (_, index) => `node:l:${index + 1}`);
    const interfaceIds = Array.from({ length: 40 }, (_, index) => `board.${index + 1}.operation`);
    arch.mountAll(nodeIds, interfaceIds);
    arch.setConnected('node:l:12', 'board.20.operation', false);

    expect(arch.snapshot()).toHaveLength(960);
    expect(arch.state('node:l:12', 'board.20.operation')).toBe('disconnected');
    expect(arch.state('node:l:12', 'board.21.operation')).toBe('connected');
    expect(arch.state('node:l:13', 'board.20.operation')).toBe('connected');
    await expect(arch.exchange('node:l:12', 'board.20.operation', null, async () => 'unexpected'))
      .resolves.toEqual({ connected: false });
    await expect(arch.exchange('node:l:24', 'board.40.operation', null, async () => 'ok'))
      .resolves.toEqual({ connected: true, output: 'ok' });
  });
});
