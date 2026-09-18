import { ArchBoard } from '@shop/l-kernel/arch';
import { describe, expect, it, vi } from 'vitest';
import type { OperationRequest } from '../foundation/application/OperationHandler';
import type { AccessContext } from '../foundation/security/AccessContext';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { connectHostedOperation } from './ArchOperationAdapter';
import { bootstrapApi, SERVER_NODE_MANIFEST_REGISTRY } from './ApiBootstrap';
import { defineSelectedModule } from './DefinedModule';
import { ExtensionRegistry } from './ExtensionRegistry';

function request(nodeId: string, hostNodeId: string | null): OperationRequest {
  return {
    type: 'member.profile.read', input: { path: {}, query: {}, headers: {}, body: null },
    access: { actor: { nodeContext: { node_id: nodeId, host_node_id: hostNodeId } } },
  } as unknown as OperationRequest;
}

describe('hosted L Arch operation adapter', () => {
  it('uses the session-resolved hosted node without changing the host or another hosted node', async () => {
    const arch = new ArchBoard();
    arch.mountAll(['node:hosted:l2:a', 'node:hosted:l2:b'], ['member.profile.read']);
    const invoke = vi.fn(async (input: OperationRequest) => ({ status: 200, body: { node: input.access?.actor.nodeContext?.node_id } }));
    const connected = connectHostedOperation({ invoke }, arch);
    expect(await connected.invoke(request('node:hosted:l2:a', 'node:host:l1')))
      .toEqual({ status: 200, body: { node: 'node:hosted:l2:a' } });

    arch.setConnected('node:hosted:l2:a', 'member.profile.read', false);
    await expect(connected.invoke(request('node:hosted:l2:a', 'node:host:l1'))).rejects.toThrow('NOT_FOUND');
    expect(await connected.invoke(request('node:hosted:l2:b', 'node:host:l1')))
      .toEqual({ status: 200, body: { node: 'node:hosted:l2:b' } });
    expect(await connected.invoke(request('node:host:l1', null)))
      .toEqual({ status: 200, body: { node: 'node:host:l1' } });
    expect(arch.state('node:host:l1', 'member.profile.read')).toBe('unmounted');
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('passes through an operation without a session node', async () => {
    const invoke = vi.fn(async () => ({ status: 200 }));
    const connected = connectHostedOperation({ invoke }, new ArchBoard());
    await expect(connected.invoke({ type: 'member.profile.read', input: { path: {}, query: {}, headers: {}, body: null },
      access: null } as unknown as OperationRequest)).resolves.toEqual({ status: 200 });
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('reaches the hosted node switch through the real HTTP bootstrap without changing the host switch', async () => {
    const arch = new ArchBoard();
    const invoke = vi.fn(async () => ({ status: 200, body: { owner: 'member' } }));
    const bootstrapped = await bootstrapApi({
      modules: [defineSelectedModule('member', ['member.profile.read'], () => ({ invoke }))],
      operationIds: ['member.profile.read'], nodeManifestRegistry: SERVER_NODE_MANIFEST_REGISTRY,
      arch, extensions: new ExtensionRegistry({ verify: async () => true } as never),
      allowedOrigins: [], telemetry: commerceTelemetry(),
      configure(container) {
        container.bind(OPERATION_HANDLERS, new Map());
        container.bind(OPERATION_AUTHORIZER, { authorize: async () => ({ actor: {
          nodeContext: { node_id: 'node:hosted:l2', host_node_id: 'node:hbbtzn:l1' },
        } }) as AccessContext });
      },
    });
    const send = () => bootstrapped.app.handle(new Request('https://accounts.hbbtzn.com/api/v1/members/me'));
    expect(arch.state('node:hbbtzn:l1', 'member.profile.read')).toBe('connected');
    arch.mount('node:hosted:l2', 'member.profile.read');
    arch.setConnected('node:hosted:l2', 'member.profile.read', false);
    expect((await send()).status).toBe(404);
    expect(invoke).not.toHaveBeenCalled();
    expect(arch.state('node:hbbtzn:l1', 'member.profile.read')).toBe('connected');
    arch.setConnected('node:hosted:l2', 'member.profile.read', true);
    const response = await send();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ owner: 'member' });
    expect(invoke).toHaveBeenCalledOnce();
    arch.unmount('node:hosted:l2', 'member.profile.read');
    expect((await send()).status).toBe(404);
    expect(arch.state('node:hbbtzn:l1', 'member.profile.read')).toBe('connected');
    expect(invoke).toHaveBeenCalledOnce();
    arch.mount('node:hosted:l2', 'member.profile.read');
    expect((await send()).status).toBe(200);
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
