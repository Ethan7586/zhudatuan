import type { ConsoleContext } from '../../../entity/session/ConsoleSession';

export type ProductRestockStage = 'uploading' | 'validating' | 'applying' | 'completed';

export interface ProductRestockInput {
  readonly sku: string;
  readonly location: string;
  readonly currentOnhand: number;
  readonly quantity: number;
  readonly safety: number;
}

export interface ProductRestockWorkflow {
  readonly createIdentity: () => string;
  execute(context: ConsoleContext, file: File, identity: string, progress?: (stage: ProductRestockStage) => void, signal?: AbortSignal): Promise<void>;
}

export class RestockProduct {
  constructor(private readonly workflow: ProductRestockWorkflow) {}

  async execute(context: ConsoleContext, input: ProductRestockInput, progress?: (stage: ProductRestockStage) => void, signal?: AbortSignal): Promise<void> {
    validate(input);
    progress?.('uploading');
    const identity = this.workflow.createIdentity();
    await this.workflow.execute(context, inventoryFile(input, identity), identity, progress, signal);
    progress?.('completed');
  }
}

export function inventoryFile(input: ProductRestockInput, receipt: string): File {
  validate(input);
  if (receipt.trim().length === 0 || receipt.length > 128) throw new Error('库存操作凭据无效，请重新提交。');
  const target = input.currentOnhand + input.quantity;
  const row = [input.sku, input.location, String(target), String(input.safety), 'active', receipt].map(csvCell).join(',');
  return new File([`sku,location,onhand,safety,status,receipt\n${row}\n`], '单品补库存.csv', {
    type: 'text/csv',
    lastModified: Date.now(),
  });
}

function validate(input: ProductRestockInput): void {
  if (input.sku.trim().length === 0 || input.location.trim().length === 0) throw new Error('商品库存信息不完整，请刷新后重试。');
  for (const value of [input.currentOnhand, input.quantity, input.safety]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('库存数量必须是大于或等于 0 的整数。');
  }
  if (input.quantity < 1) throw new Error('本次增加数量必须大于 0。');
  if (!Number.isSafeInteger(input.currentOnhand + input.quantity)) throw new Error('库存数量超出可支持范围。');
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
