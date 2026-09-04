import type { GatePlugin } from '@shop/kernel';

export class GateRegistry {
  readonly #pluginsBySlot = new Map<string, GatePlugin>();

  constructor(plugins: readonly GatePlugin[] = []) {
    for (const plugin of plugins) this.register(plugin);
  }

  register(plugin: GatePlugin): void {
    this.#pluginsBySlot.set(plugin.gate_slot, plugin);
  }

  replace(plugin: GatePlugin): GatePlugin | undefined {
    const previous = this.#pluginsBySlot.get(plugin.gate_slot);
    this.#pluginsBySlot.set(plugin.gate_slot, plugin);
    return previous;
  }

  get(gateSlot: string): GatePlugin | undefined {
    return this.#pluginsBySlot.get(gateSlot);
  }
}
