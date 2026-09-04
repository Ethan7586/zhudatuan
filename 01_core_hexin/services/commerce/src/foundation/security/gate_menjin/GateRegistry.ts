import type { GatePlugin } from '@shop/kernel';

export class GateRegistry {
  readonly #pluginsBySlot: ReadonlyMap<string, GatePlugin>;

  constructor(plugins: readonly GatePlugin[] = []) {
    this.#pluginsBySlot = new Map(plugins.map((plugin) => [plugin.gate_slot, plugin]));
  }

  get(gateSlot: string): GatePlugin | undefined {
    return this.#pluginsBySlot.get(gateSlot);
  }
}
