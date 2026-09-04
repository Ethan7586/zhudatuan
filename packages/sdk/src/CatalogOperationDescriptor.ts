import type { ApiErrorCode, OperationId } from '@shop/contract';
import type { OperationDescriptor } from './OperationDescriptor';

type DescriptorInput<TKey extends OperationId> = Pick<OperationDescriptor<TKey>, 'id' | 'method' | 'path' | 'audience' | 'targets' | 'responseMode' | 'idempotencyPolicy' | 'idempotent' | 'timeout' | 'input' | 'output'> &
  Readonly<{ errorUnion: readonly ApiErrorCode[] }>;

export function defineOperation<TKey extends OperationId>(definition: Readonly<DescriptorInput<TKey>>): OperationDescriptor<TKey> {
  return Object.freeze({
    ...definition,
    targets: Object.freeze([...definition.targets]),
    errorUnion: Object.freeze([...definition.errorUnion]),
  });
}
