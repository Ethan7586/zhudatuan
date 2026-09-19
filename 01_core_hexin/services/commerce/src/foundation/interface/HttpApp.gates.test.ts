import { CONTRACT_VERSION, OperationCatalog, type OperationId } from '@shop/contract';
import type { GateContext, GateDecision, GatePlugin } from '@shop/kernel';
import { ArchBoard } from '@shop/l-kernel/arch';
import { describe, expect, it, vi } from 'vitest';
import type { RouteRegistry } from '../../bootstrap/RouteRegistry';
import { GateEngine, GateRegistry } from '../security/gate_menjin';
import { HttpApp } from './HttpApp';

const catalogBody = Object.freeze({ items: [{ id: 'listing:one', title: 'Product' }] });

describe('HttpApp observe gates', () => {
  it('invokes the declared Catalog gate exactly once without changing the HTTP response', async () => {
    const evaluate = vi.fn(async (context: GateContext): Promise<GateDecision> => ({
      decision: 'not_applicable',
      gate_id: 'permission.noop',
      policy_version: 'test',
      reason_code: 'test_noop',
      trace_id: context.trace_id,
      duration_ms: 0,
    }));
    const observed = vi.fn();
    const engine = new GateEngine(new GateRegistry([plugin(evaluate)]), observed);
    const execute = vi.spyOn(engine, 'execute');
    const handler = vi.fn(async () => ({ status: 200, body: catalogBody, headers: { 'x-catalog': 'stable' } }));

    const baseline = await snapshot(await new HttpApp(routes('catalog.listings.read', handler), []).handle(request('/api/v1/catalog/listings')));
    const gated = await snapshot(await new HttpApp(routes('catalog.listings.read', handler), [], undefined, undefined, undefined, engine)
      .handle(request('/api/v1/catalog/listings')));

    expect(gated).toEqual(baseline);
    expect(OperationCatalog.all().filter((operation) => operation.gates !== undefined).map((operation) => operation.id))
      .toEqual(['catalog.listings.read']);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(observed).toHaveBeenCalledTimes(1);
  });

  it('fully bypasses Operations without a gates declaration', async () => {
    const evaluate = vi.fn(async (context: GateContext): Promise<GateDecision> => decision(context));
    const engine = new GateEngine(new GateRegistry([plugin(evaluate)]), vi.fn());
    const execute = vi.spyOn(engine, 'execute');

    const response = await new HttpApp(routes('pricing.offers.read'), [], undefined, undefined, undefined, engine)
      .handle(request('/api/v1/pricing/offers'));

    expect(response.status).toBe(200);
    expect(execute).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('records an explicit observation and continues when production has no plugins', async () => {
    const observed = vi.fn();
    const engine = new GateEngine(new GateRegistry(), observed);

    const response = await new HttpApp(routes('catalog.listings.read'), [], undefined, undefined, undefined, engine)
      .handle(request('/api/v1/catalog/listings'));

    expect(response.status).toBe(200);
    expect(observed).toHaveBeenCalledWith(expect.objectContaining({
      decisions: [expect.objectContaining({
        decision: 'not_applicable',
        gate_id: 'permission.unregistered',
        policy_version: 'none',
        reason_code: 'gate_plugin_not_installed',
      })],
    }));
  });

  it('records plugin errors without changing the original handler result', async () => {
    const evaluate = vi.fn(async (): Promise<GateDecision> => { throw new Error('unavailable'); });
    const observed = vi.fn();
    const engine = new GateEngine(new GateRegistry([plugin(evaluate)]), observed);

    const response = await snapshot(await new HttpApp(routes('catalog.listings.read'), [], undefined, undefined, undefined, engine)
      .handle(request('/api/v1/catalog/listings')));

    expect(response).toMatchObject({ status: 200, body: catalogBody });
    expect(observed).toHaveBeenCalledWith(expect.objectContaining({
      decisions: [expect.objectContaining({ decision: 'error', reason_code: 'gate_plugin_error' })],
    }));
  });

  it('does not evaluate gates for a disconnected interface', async () => {
    const evaluate = vi.fn(async (context: GateContext): Promise<GateDecision> => decision(context));
    const engine = new GateEngine(new GateRegistry([plugin(evaluate)]), vi.fn());
    const execute = vi.spyOn(engine, 'execute');
    const arch = new ArchBoard([
      { nodeId: 'unresolved', interfaceId: 'catalog.listings.read', state: 'disconnected' },
    ]);

    const response = await new HttpApp(routes('catalog.listings.read'), [], undefined, undefined, undefined, engine, undefined, arch)
      .handle(request('/api/v1/catalog/listings'));

    expect(response.status).toBe(404);
    expect(execute).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
  });
});

function plugin(evaluate: GatePlugin['evaluate']): GatePlugin {
  return { gate_id: 'permission.noop', gate_slot: 'permission', policy_version: 'test', evaluate };
}

function decision(context: GateContext): GateDecision {
  return { decision: 'allow', gate_id: 'permission.noop', policy_version: 'test', reason_code: 'test_allow',
    trace_id: context.trace_id, duration_ms: 0 };
}

function routes(operation: OperationId, handler = vi.fn(async () => ({ status: 200, body: catalogBody }))): RouteRegistry {
  return { match: () => ({ operation, parameters: {}, handler }) } as unknown as RouteRegistry;
}

function request(path: string): Request {
  return new Request(`https://api.example${path}`, { headers: {
    'x-contract-version': CONTRACT_VERSION,
    'x-request-id': 'request-1',
    'x-trace-id': 'trace-1',
  } });
}

async function snapshot(response: Response): Promise<Readonly<{ status: number; body: unknown; catalog: string | null }>> {
  return { status: response.status, body: await response.json(), catalog: response.headers.get('x-catalog') };
}
