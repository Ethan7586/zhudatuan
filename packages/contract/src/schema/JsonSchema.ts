import { array, boolean, lazy, null as nullSchema, number, record, string, union, type ZodMiniType } from 'zod/mini';

export type ContractJsonScalar = string | number | boolean | null;
export type ContractJsonValue = ContractJsonScalar | ContractJsonObject | readonly ContractJsonValue[];
export interface ContractJsonObject {
  readonly [key: string]: ContractJsonValue;
}

export const ContractJsonValueSchema: ZodMiniType<ContractJsonValue> = lazy(() => union([string(), number(), boolean(), nullSchema(), array(ContractJsonValueSchema), record(string(), ContractJsonValueSchema)]));
