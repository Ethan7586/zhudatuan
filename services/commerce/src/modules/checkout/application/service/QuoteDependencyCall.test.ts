import { describe, expect, it } from 'vitest';
import { QuoteDependencyCall } from './QuoteDependencyCall';

describe('QuoteDependencyCall', () => {
  it('maps an individual dependency deadline to its actionable code', async () => {
    const call = new QuoteDependencyCall(5);
    await expect(call.execute('catalog', control(100), () => new Promise(() => undefined))).rejects.toMatchObject({ code: 'CHECKOUT_CATALOG_TIMEOUT' });
  });

  it('preserves the total request deadline instead of mislabeling it', async () => {
    const call = new QuoteDependencyCall(100);
    await expect(call.execute('pricing', control(5), () => new Promise(() => undefined))).rejects.toMatchObject({ code: 'DEADLINE_EXCEEDED' });
  });

  it('preserves dependency failures', async () => {
    const call = new QuoteDependencyCall(100);
    await expect(call.execute('inventory', control(50), () => Promise.reject(new Error('INVENTORY_FAILED')))).rejects.toThrow('INVENTORY_FAILED');
  });
});

function control(milliseconds: number) {
  return { expiresAt: Date.now() + milliseconds, signal: new AbortController().signal };
}
