import { describe, expect, it, vi } from 'vitest';
import { CustomerMemberPreset, DimensionPresetReader } from '../application/service/DimensionPreset';
import { SalesReadHandler } from '../application/handler/SalesReadHandler';

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
  it('keeps ordinary sales on the governed sales dimension with an explicit null preset', async () => {
    const read = vi.fn().mockResolvedValue({ status: 200, body: page });
    const reply = await new SalesReadHandler({ read } as never).execute({ query: { period: '30days', limit: 50 } }, context());

    expect(read).toHaveBeenCalledWith('reporting.sales.read', expect.anything(), expect.anything(), 'sales');
    expect(reply.body).toEqual({ ...page, preset: null });
  });

  it('routes the named preset through the member projection without adding a compatibility operation', async () => {
    const read = vi.fn().mockResolvedValue({ status: 200, body: page });
    const dimensions = new DimensionPresetReader({ read } as never);
    const reply = await new SalesReadHandler({ read } as never, dimensions).execute({ query: { dimensionpreset: 'customermember', limit: 50 } }, context());

    expect(read).toHaveBeenCalledWith('reporting.sales.read', expect.anything(), expect.anything(), 'member');
    expect(reply.body).toEqual({ ...page, preset: CustomerMemberPreset });
    expect(CustomerMemberPreset).toMatchObject({
      code: 'customermember',
      dimensions: ['customer', 'member'],
      privacy: 'masked',
      version: 1,
      owner: 'reporting',
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
