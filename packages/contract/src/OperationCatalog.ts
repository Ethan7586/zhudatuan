import { COMMERCE_OPERATIONS } from './operations/CommerceCatalog';

export type OperationDefinition = (typeof COMMERCE_OPERATIONS)[number];
export type OperationId = OperationDefinition['id'];

const byId = new Map<string, OperationDefinition>(COMMERCE_OPERATIONS.map((definition) => [definition.id, definition]));
const byRoute = new Map(COMMERCE_OPERATIONS.map((definition) => [`${definition.method} ${definition.path}`, definition]));

if (byId.size !== COMMERCE_OPERATIONS.length) throw new Error('OPERATION_ID_DUPLICATE');
if (byRoute.size !== COMMERCE_OPERATIONS.length) throw new Error('OPERATION_ROUTE_DUPLICATE');

export const OperationCatalog = Object.freeze({
  all: (): readonly OperationDefinition[] => COMMERCE_OPERATIONS,
  get(id: string): OperationDefinition {
    const definition = byId.get(id);
    if (!definition) throw new Error('OPERATION_UNKNOWN');
    return definition;
  },
});
