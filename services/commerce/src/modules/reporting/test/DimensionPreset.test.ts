import { describe, expect, it, vi } from 'vitest';
import { DimensionsReadHandler } from '../application/handler/DimensionsReadHandler';
import { SalesReadHandler } from '../application/handler/SalesReadHandler';
import { CUSTOMER_MEMBER_PRESET, DIMENSION_PRESETS } from '../domain/value/DimensionCatalog';

const page = Object.freeze({
  items: Object.freeze([]),
  count: 0,
  snapshot: Object.freeze({
    query: Object.freeze({ scope: 'mall:one', dimension: 'sales', period: '30days', application: null }),
    watermark: Object.freeze({ event: 'event:one', occurredAt: '2026-09-05T00:00:00.000Z', version: 1 }),
    generatedAt: '2026-09-05T00:00:01.000Z',
    generationVersion: 1,
  }),
});

describe('report customer and member dimension preset', () => {
  it('keeps ordinary sales on the governed sales dimension', async () => {
    const read = vi.fn().mockResolvedValue({ status: 200, body: page });
    const reply = await new SalesReadHandler({ read } as never).execute({ query: { period: '30days', limit: 50 } }, context());

    expect(read).toHaveBeenCalledWith('reporting.sales.read', expect.anything(), expect.anything(), 'sales');
    expect(reply.body).toEqual(page);
  });

  it('routes the named preset through the member projection without restoring the retired operation', async () => {
    const read = vi.fn().mockResolvedValue({ status: 200, body: page });
    const reply = await new SalesReadHandler({ read } as never).execute({ query: { dimensionpreset: 'customermember', limit: 50 } }, context());

    expect(read).toHaveBeenCalledWith('reporting.sales.read', expect.anything(), expect.anything(), 'member');
    expect(reply.body).toEqual(page);
    expect(DIMENSION_PRESETS[0]).toMatchObject({
      code: 'customermember',
      dimensions: ['customer', 'member'],
      privacy: 'masked',
      version: 1,
      owner: 'reporting',
    });
  });

  it('publishes the one authoritative preset and named application choices from the dimensions handler', async () => {
    const { reportDimension: _reportDimension, ...publicPreset } = CUSTOMER_MEMBER_PRESET;
    const catalogFor = vi.fn().mockResolvedValue({
      definitions: [{ code: 'application', name: '商城应用' }],
      presets: [publicPreset],
      applications: [{ value: 'application:one', label: '总部福利商城' }],
    });
    const reply = await new DimensionsReadHandler({ catalogFor } as never).execute({}, dimensionsContext());

    expect(catalogFor).toHaveBeenCalledWith(expect.anything(), 'mall:one');
    expect(reply.body).toMatchObject({
      definitions: [{ code: 'application', name: '商城应用' }],
      presets: [{ code: 'customermember', name: '客户 / 会员分层' }],
      applications: [{ value: 'application:one', label: '总部福利商城' }],
    });
  });

  it('fails closed if an unparsed caller supplies an unknown preset', async () => {
    const read = vi.fn();
    await expect(new SalesReadHandler({ read } as never).execute({ query: { dimensionpreset: 'powderclass' } } as never, context())).rejects.toThrow('REPORT_DIMENSION_PRESET_INVALID');
    expect(read).not.toHaveBeenCalled();
  });
});

function context() {
  return {
    operation: 'reporting.sales.read',
    transaction: {},
    security: { kind: 'session', access: { scope: { id: 'mall:one' } } },
  } as never;
}

function dimensionsContext() {
  return {
    operation: 'reporting.dimensions.read',
    transaction: {},
    security: { kind: 'session', access: { scope: { id: 'mall:one' } } },
  } as never;
}
