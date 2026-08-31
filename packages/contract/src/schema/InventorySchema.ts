import { strictObject, string } from 'zod/mini';
import { importCreated, importInput, importRead } from './ImportSchema';

export const INVENTORY_QUERY_SCHEMAS = {
  InventoryImportsReadInput: strictObject({ job: string() }),
} as const;
export const INVENTORY_BODY_SCHEMAS = { InventoryImportsCreateInput: importInput } as const;
export const INVENTORY_OUTPUT_SCHEMAS = { InventoryImportsCreateOutput: importCreated, InventoryImportsReadOutput: importRead } as const;
