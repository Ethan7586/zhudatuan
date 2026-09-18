import { describe, expect, it, vi } from 'vitest';
import { ArchBoard } from './ArchBoard';

describe('ArchBoard', () => {
  it('mounts one interface, passes data to its owner, and isolates switches by node and interface', async () => {
    const arch = new ArchBoard();
    const owner = vi.fn(async (input: { value: number }) => ({ doubled: input.value * 2 }));
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('unmounted');
    arch.mount('node:hbbtzn:l1', 'member.read');
    expect(await arch.exchange('node:hbbtzn:l1', 'member.read', { value: 2 }, owner))
      .toEqual({ connected: true, output: { doubled: 4 } });
    arch.setConnected('node:hbbtzn:l1', 'member.read', false);
    expect(await arch.exchange('node:hbbtzn:l1', 'member.read', { value: 3 }, owner))
      .toEqual({ connected: false });
    expect(arch.state('node:hbbtzn:l1', 'member.write')).toBe('unmounted');
    expect(await arch.exchange('node:hbbtzn:l1', 'member.write', { value: 4 }, owner))
      .toEqual({ connected: true, output: { doubled: 8 } });
    expect(await arch.exchange('node:other:l1', 'member.read', { value: 5 }, owner))
      .toEqual({ connected: true, output: { doubled: 10 } });
    expect(arch.inspect('node:hbbtzn:l1', ['member.read', 'member.write'])).toEqual([
      { nodeId: 'node:hbbtzn:l1', interfaceId: 'member.read', state: 'disconnected' },
      { nodeId: 'node:hbbtzn:l1', interfaceId: 'member.write', state: 'unmounted' },
    ]);
    arch.setConnected('node:hbbtzn:l1', 'member.read', true);
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('connected');
    arch.unmount('node:hbbtzn:l1', 'member.read');
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('unmounted');
    expect(await arch.exchange('node:hbbtzn:l1', 'member.read', { value: 6 }, owner))
      .toEqual({ connected: false });
    arch.setConnected('node:hbbtzn:l1', 'member.read', true);
    expect(arch.state('node:hbbtzn:l1', 'member.read')).toBe('unmounted');
    expect(owner).toHaveBeenCalledTimes(3);
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
      { nodeId: 'node:l1', interfaceId: 'member.read', state: 'unmounted' },
      { nodeId: 'node:l1', interfaceId: 'order.read', state: 'connected' },
    ]);
    expect(await arch.exchange('node:l1', 'member.read', null, owner)).toEqual({ connected: false });
    expect(await arch.exchange('node:l0', 'member.read', null, owner)).toEqual({ connected: true, output: 'ok' });
    arch.mount('node:l1', 'member.read');
    expect(await arch.exchange('node:l1', 'member.read', null, owner)).toEqual({ connected: true, output: 'ok' });
    expect(owner).toHaveBeenCalledTimes(2);
  });
});
