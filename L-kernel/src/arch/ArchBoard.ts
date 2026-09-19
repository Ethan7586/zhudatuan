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
    for (const connection of initial) {
      if (connection.state === 'connected') this.connections.set(key(connection.nodeId, connection.interfaceId), true);
      else if (connection.state === 'disconnected') this.connections.set(key(connection.nodeId, connection.interfaceId), false);
      else if (connection.state === 'removed') this.connections.set(key(connection.nodeId, connection.interfaceId), null);
    }
  }

  mount(nodeId: string, interfaceId: string): void {
    this.connections.set(key(nodeId, interfaceId), true);
  }

  mountAll(nodeIds: readonly string[], interfaceIds: readonly string[]): void {
    for (const nodeId of nodeIds)
      for (const interfaceId of interfaceIds)
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
  return JSON.stringify([nodeId, interfaceId]);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
