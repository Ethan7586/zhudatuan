export type ArchConnectionState = 'unmounted' | 'connected' | 'disconnected';

export interface ArchConnection {
  readonly nodeId: string;
  readonly interfaceId: string;
  readonly state: ArchConnectionState;
}

/** Node-scoped interface wiring. The caller keeps the route and the owner keeps the data. */
export class ArchBoard {
  private readonly connections = new Map<string, boolean>();

  mount(nodeId: string, interfaceId: string): void {
    this.connections.set(key(nodeId, interfaceId), true);
  }

  mountAll(nodeIds: readonly string[], interfaceIds: readonly string[]): void {
    for (const nodeId of nodeIds)
      for (const interfaceId of interfaceIds)
        if (this.state(nodeId, interfaceId) === 'unmounted') this.mount(nodeId, interfaceId);
  }

  unmount(nodeId: string, interfaceId: string): void {
    this.connections.delete(key(nodeId, interfaceId));
  }

  setConnected(nodeId: string, interfaceId: string, connected: boolean): void {
    if (this.connections.has(key(nodeId, interfaceId))) this.connections.set(key(nodeId, interfaceId), connected);
  }

  state(nodeId: string, interfaceId: string): ArchConnectionState {
    const connected = this.connections.get(key(nodeId, interfaceId));
    return connected === undefined ? 'unmounted' : connected ? 'connected' : 'disconnected';
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
    if (this.state(nodeId, interfaceId) === 'disconnected') return { connected: false };
    return { connected: true, output: await recipient(input) };
  }
}

function key(nodeId: string, interfaceId: string): string {
  return JSON.stringify([nodeId, interfaceId]);
}
