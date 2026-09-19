export type ArchConnectionState = 'unmounted' | 'connected' | 'disconnected' | 'removed';

export interface ArchConnection {
  readonly nodeId: string;
  readonly interfaceId: string;
  readonly state: ArchConnectionState;
}

/** Node-scoped interface wiring. The caller keeps the route and the owner keeps the data. */
export class ArchBoard {
  // null is an explicit removal; an untouched key is not connected.
  private readonly connections = new Map<string, boolean | null>();

  constructor(initial: readonly ArchConnection[] = []) {
    this.replace(initial);
  }

  replace(connections: readonly ArchConnection[]): void {
    const next = new Map<string, boolean | null>();
    for (const connection of connections) {
      const connectionKey = key(connection.nodeId, connection.interfaceId);
      if (connection.state === 'connected') next.set(connectionKey, true);
      else if (connection.state === 'disconnected') next.set(connectionKey, false);
      else if (connection.state === 'removed') next.set(connectionKey, null);
      else if (connection.state !== 'unmounted') throw new Error('L_ARCH_CONNECTION_STATE_INVALID');
    }
    this.connections.clear();
    for (const [connectionKey, connected] of next) this.connections.set(connectionKey, connected);
  }

  mount(nodeId: string, interfaceId: string): void {
    this.connections.set(key(nodeId, interfaceId), true);
  }

  mountAll(nodeIds: readonly string[], interfaceIds: readonly string[]): void {
    const validatedNodeIds = nodeIds.map((nodeId) => identifier(nodeId, 'L_ARCH_NODE_ID_INVALID'));
    const validatedInterfaceIds = interfaceIds.map((interfaceId) => identifier(interfaceId, 'L_ARCH_INTERFACE_ID_INVALID'));
    for (const nodeId of validatedNodeIds)
      for (const interfaceId of validatedInterfaceIds)
        if (!this.connections.has(key(nodeId, interfaceId))) this.mount(nodeId, interfaceId);
  }

  unmount(nodeId: string, interfaceId: string): void {
    this.connections.set(key(nodeId, interfaceId), null);
  }

  setConnected(nodeId: string, interfaceId: string, connected: boolean): void {
    const connection = this.connections.get(key(nodeId, interfaceId));
    if (connection !== undefined && connection !== null) this.connections.set(key(nodeId, interfaceId), connected);
  }

  state(nodeId: string, interfaceId: string): ArchConnectionState {
    const connected = this.connections.get(key(nodeId, interfaceId));
    return connected === undefined ? 'unmounted' : connected === null ? 'removed' : connected ? 'connected' : 'disconnected';
  }

  inspect(nodeId: string, interfaceIds: readonly string[]): readonly ArchConnection[] {
    return Object.freeze(interfaceIds.map((interfaceId) => Object.freeze({
      nodeId, interfaceId, state: this.state(nodeId, interfaceId),
    })));
  }

  snapshot(): readonly ArchConnection[] {
    return Object.freeze([...this.connections.entries()]
      .map(([connectionKey, connected]) => {
        const [nodeId, interfaceId] = JSON.parse(connectionKey) as [string, string];
        return Object.freeze({
          nodeId,
          interfaceId,
          state: connected === null ? 'removed' : connected ? 'connected' : 'disconnected',
        } satisfies ArchConnection);
      })
      .sort((left, right) => compare(left.nodeId, right.nodeId)
        || compare(left.interfaceId, right.interfaceId)));
  }

  async exchange<Input, Output>(
    nodeId: string,
    interfaceId: string,
    input: Input,
    recipient: (input: Input) => Promise<Output>,
  ): Promise<Readonly<{ connected: true; output: Output } | { connected: false }>> {
    const connection = this.connections.get(key(nodeId, interfaceId));
    if (connection !== true) return { connected: false };
    return { connected: true, output: await recipient(input) };
  }
}

function key(nodeId: string, interfaceId: string): string {
  return JSON.stringify([
    identifier(nodeId, 'L_ARCH_NODE_ID_INVALID'),
    identifier(interfaceId, 'L_ARCH_INTERFACE_ID_INVALID'),
  ]);
}

function identifier(value: string, code: string): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || value.length > 240) throw new Error(code);
  return value;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
