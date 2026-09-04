import type { GateContext, GateDecision, GateDeclaration } from '@shop/kernel';
import type { GateRegistry } from './GateRegistry';

export class GateEngine {
  constructor(
    private readonly registry: GateRegistry,
    private readonly observe: (observation: Readonly<{
      declaration: GateDeclaration;
      context: GateContext;
      decisions: readonly GateDecision[];
    }>) => void | Promise<void> = () => undefined,
  ) {}

  async execute(
    declaration: GateDeclaration,
    context: GateContext,
  ): Promise<readonly GateDecision[]> {
    if (declaration.mode !== 'observe') return [];

    const decisions: GateDecision[] = [];
    for (const gateSlot of declaration.gate_slots) {
      const plugin = this.registry.get(gateSlot);
      if (plugin === undefined) {
        decisions.push({
          decision: 'not_applicable',
          gate_id: `${gateSlot}.unregistered`,
          policy_version: 'none',
          reason_code: 'gate_plugin_not_installed',
          trace_id: context.trace_id,
          duration_ms: 0,
        });
        continue;
      }

      const startedAt = Date.now();
      try {
        decisions.push(await plugin.evaluate(context));
      } catch {
        decisions.push({
          decision: 'error',
          gate_id: plugin.gate_id,
          policy_version: plugin.policy_version,
          reason_code: 'gate_plugin_error',
          trace_id: context.trace_id,
          duration_ms: Math.max(0, Date.now() - startedAt),
        });
      }
    }

    const observed = Object.freeze(decisions);
    try {
      await this.observe(Object.freeze({ declaration, context, decisions: observed }));
    } catch {
      // Observation failures never affect the operation being observed.
    }
    return observed;
  }
}
