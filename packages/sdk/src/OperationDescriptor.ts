import type {
  HttpMethod,
  OperationAudience,
  OperationId,
  OperationInputFor,
  OperationOutputFor,
  Schema,
} from '@shop/contract';
import { structuralOperationInput, structuralOperationOutput } from '@shop/contract/schema';
import type { RequestContext } from './RequestContext';

export interface OperationDescriptor<TKey extends OperationId> {
  readonly id: TKey;
  readonly method: HttpMethod;
  readonly path: `/api/v1/${string}` | `/health/${string}`;
  readonly audience: OperationAudience;
  readonly idempotent: boolean;
  readonly input: Schema<OperationInputFor<TKey>>;
  readonly output: Schema<OperationOutputFor<TKey>>;
}

export interface OperationExecutor {
  execute<TKey extends OperationId>(
    operation: OperationDescriptor<TKey>,
    input: OperationInputFor<TKey>,
    context: RequestContext,
  ): Promise<OperationOutputFor<TKey>>;
}

export type OperationMethod<TKey extends OperationId> = (
  input: OperationInputFor<TKey>,
  context: RequestContext,
) => Promise<OperationOutputFor<TKey>>;

export function defineStructuralOperation<TKey extends OperationId>(definition: Readonly<{
  id: TKey;
  method: HttpMethod;
  path: `/api/v1/${string}` | `/health/${string}`;
  audience: OperationAudience;
  idempotent: boolean;
  pathKeys: readonly string[];
}>): OperationDescriptor<TKey> {
  return Object.freeze({
    id: definition.id,
    method: definition.method,
    path: definition.path,
    audience: definition.audience,
    idempotent: definition.idempotent,
    input: structuralOperationInput(definition.pathKeys) as Schema<OperationInputFor<TKey>>,
    output: structuralOperationOutput() as Schema<OperationOutputFor<TKey>>,
  });
}

export function bindOperation<TKey extends OperationId>(
  client: OperationExecutor,
  operation: OperationDescriptor<TKey>,
): OperationMethod<TKey> {
  return (input, context) => client.execute(operation, input, context);
}
