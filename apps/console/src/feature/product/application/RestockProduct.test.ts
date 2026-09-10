import { describe, expect, it, vi } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { inventoryFile, RestockProduct, type ProductRestockWorkflow } from './RestockProduct';

describe('RestockProduct', () => {
  it('turns a beginner-friendly increase into an absolute stock row', async () => {
    const execute = vi.fn(async (_context, file: File, _identity, progress) => {
      expect(await file.text()).toBe('sku,location,onhand,safety,status,receipt\nSKU-1,warehouse:main,17,2,active,command:1\n');
      progress?.('validating');
      progress?.('applying');
    });
    const stages: string[] = [];
    const usecase = new RestockProduct({ execute, createIdentity: () => 'command:1' } as ProductRestockWorkflow);

    await usecase.execute(context, { sku: 'SKU-1', location: 'warehouse:main', currentOnhand: 12, quantity: 5, safety: 2 }, (stage) => stages.push(stage));

    expect(stages).toEqual(['uploading', 'validating', 'applying', 'completed']);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('preserves CSV meaning when identifiers contain commas or quotes', async () => {
    const file = inventoryFile({ sku: 'SKU,"礼盒"', location: '华东,主仓', currentOnhand: 0, quantity: 8, safety: 1 }, 'command:two');
    expect(await file.text()).toBe('sku,location,onhand,safety,status,receipt\n"SKU,""礼盒""","华东,主仓",8,1,active,command:two\n');
  });

  it('rejects invalid quantities before starting the workflow', async () => {
    const workflow = { execute: vi.fn(), createIdentity: () => 'command:one' } as ProductRestockWorkflow;
    const usecase = new RestockProduct(workflow);

    await expect(usecase.execute(context, { sku: 'SKU-1', location: 'main', currentOnhand: 0, quantity: 0, safety: 0 })).rejects.toThrow('本次增加数量必须大于 0');
    expect(workflow.execute).not.toHaveBeenCalled();
  });
});

const scope = { kind: 'mall', id: 'mall:one', tenant: 'tenant:one' } as const;
const context = {
  scope,
  scopes: [scope],
  profile: { display_name: '测试用户', employee_no: null },
  session: {
    actor: 'actor:one',
    membership: 'membership:one',
    scope,
    scopes: [scope],
    accessVersion: 1,
    permissions: [],
    capabilities: [],
    assurance: { level: 2 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    target: 'console',
    csrf: 'csrf:one',
    syncedAt: '2026-09-10T00:00:00.000Z',
  },
} satisfies ConsoleContext;
