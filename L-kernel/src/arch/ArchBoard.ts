export type ArchConnectionState = 'unmounted' | 'connected' | 'disconnected';

export interface ArchConnection {
  readonly nodeId: string;
  readonly interfaceId: string;
  readonly state: ArchConnectionState;
}

/** Node-scoped interface wiring. The caller keeps the route and the owner keeps the data. */
export class ArchBoard {
  // null is an explicit removal; an untouched key remains a legacy pass-through.
  private readonly connections = new Map<string, boolean | null>();

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
    return connected === undefined || connected === null ? 'unmounted' : connected ? 'connected' : 'disconnected';
  }

  inspect(nodeId: string, interfaceIds: readonly string[]): readonly ArchConnection[] {
    return Object.freeze(interfaceIds.map((interfaceId) => Object.freeze({
      nodeId, interfaceId, state: this.state(nodeId, interfaceId),
    })));
  }

  async exchange<Input, Output>(
    nodeId: string,
    interfaceId: string,
    input: Input,
    recipient: (input: Input) => Promise<Output>,
  ): Promise<Readonly<{ connected: true; output: Output } | { connected: false }>> {
    const connection = this.connections.get(key(nodeId, interfaceId));
    if (connection === false || connection === null) return { connected: false };
    return { connected: true, output: await recipient(input) };
  }
}

function key(nodeId: string, interfaceId: string): string {
  return JSON.stringify([nodeId, interfaceId]);
}
