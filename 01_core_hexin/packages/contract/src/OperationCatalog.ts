import { COMMERCE_OPERATION_DEFINITIONS, COMMERCE_OPERATIONS, FROZEN_OPERATIONS } from './operations/CommerceOperations';

export type OperationDefinition = (typeof COMMERCE_OPERATION_DEFINITIONS)[number];
export type OperationId = OperationDefinition['id'];

const byId = new Map<string, OperationDefinition>(COMMERCE_OPERATION_DEFINITIONS.map((definition) => [definition.id, definition]));
const byRoute = new Map(COMMERCE_OPERATION_DEFINITIONS.map((definition) => [`${definition.method} ${definition.path}`, definition]));

if (byId.size !== COMMERCE_OPERATION_DEFINITIONS.length) throw new Error('OPERATION_ID_DUPLICATE');
if (byRoute.size !== COMMERCE_OPERATION_DEFINITIONS.length) throw new Error('OPERATION_ROUTE_DUPLICATE');

export const OperationCatalog = Object.freeze({
  all: (): readonly OperationDefinition[] => COMMERCE_OPERATIONS,
  definitions: (): readonly OperationDefinition[] => COMMERCE_OPERATION_DEFINITIONS,
  frozen: (): readonly OperationDefinition[] => FROZEN_OPERATIONS,
  get(id: string): OperationDefinition {
    const definition = byId.get(id);
    if (!definition) throw new Error('OPERATION_UNKNOWN');
    if (definition.availability === 'frozen') throw new Error('OPERATION_FROZEN');
    return definition;
  },
  definition(id: string): OperationDefinition {
    const definition = byId.get(id);
    if (!definition) throw new Error('OPERATION_UNKNOWN');
    return definition;
  },
});
