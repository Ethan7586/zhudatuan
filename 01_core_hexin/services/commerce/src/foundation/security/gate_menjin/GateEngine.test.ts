import type { GateContext, GateDeclaration, GatePlugin } from '@shop/kernel';
import { describe, expect, it, vi } from 'vitest';
import { GateEngine, GateRegistry } from '.';

const context: GateContext = {
  operation_id: 'order.refund',
  execution_phase: 'before',
  trace_id: 'trace-1',
};

function declaration(mode: GateDeclaration['mode']): GateDeclaration {
  return {
    operation_id: context.operation_id,
    gate_slots: ['risk'],
    execution_phase: context.execution_phase,
    mode,
    failure_behavior: 'continue',
  };
}

describe('GateEngine', () => {
  it('does not invoke plugins when disabled', async () => {
    const evaluate = vi.fn<GatePlugin['evaluate']>();
    const plugin: GatePlugin = {
      gate_id: 'risk.basic',
      gate_slot: 'risk',
      policy_version: '1',
      evaluate,
    };

    const decisions = await new GateEngine(new GateRegistry([plugin])).execute(
      declaration('disabled'),
      context,
    );

    expect(decisions).toEqual([]);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('collects decisions without enforcing them in observe mode', async () => {
    const decision = {
      decision: 'deny',
      gate_id: 'risk.basic',
      policy_version: '1',
      reason_code: 'observed_risk',
      trace_id: context.trace_id,
      duration_ms: 2,
    } as const;
    const plugin: GatePlugin = {
      gate_id: decision.gate_id,
      gate_slot: 'risk',
      policy_version: decision.policy_version,
      evaluate: vi.fn(async () => decision),
    };

    await expect(
      new GateEngine(new GateRegistry([plugin])).execute(declaration('observe'), context),
    ).resolves.toEqual([decision]);
  });

  it('records plugin failures as error decisions in observe mode', async () => {
    const plugin: GatePlugin = {
      gate_id: 'risk.basic',
      gate_slot: 'risk',
      policy_version: '1',
      evaluate: vi.fn(async () => {
        throw new Error('unavailable');
      }),
    };

    const [decision] = await new GateEngine(new GateRegistry([plugin])).execute(
      declaration('observe'),
      context,
    );

    expect(decision).toMatchObject({
      decision: 'error',
      gate_id: plugin.gate_id,
      policy_version: plugin.policy_version,
      reason_code: 'gate_plugin_error',
      trace_id: context.trace_id,
    });
    expect(decision?.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('returns an explicit result when a plugin is not installed', async () => {
    const [decision] = await new GateEngine(new GateRegistry()).execute(
      declaration('observe'),
      context,
    );

    expect(decision).toEqual({
      decision: 'not_applicable',
      gate_id: 'risk.unregistered',
      policy_version: 'none',
      reason_code: 'gate_plugin_not_installed',
      trace_id: context.trace_id,
      duration_ms: 0,
    });
  });

  it('registers, finds and replaces plugins by slot', () => {
    const first: GatePlugin = {
      gate_id: 'risk.first',
      gate_slot: 'risk',
      policy_version: '1',
      evaluate: vi.fn(),
    };
    const second: GatePlugin = {
      gate_id: 'risk.second',
      gate_slot: 'risk',
      policy_version: '2',
      evaluate: vi.fn(),
    };
    const registry = new GateRegistry();

    registry.register(first);
    expect(registry.get('risk')).toBe(first);
    expect(registry.replace(second)).toBe(first);
    expect(registry.get('risk')).toBe(second);
  });
});
