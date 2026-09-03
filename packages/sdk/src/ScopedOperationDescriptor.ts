import type { ApiErrorCode, OperationId } from '@shop/contract';
import type { OperationDescriptor } from './OperationDescriptor';

type ScopedDescriptorInput<TKey extends OperationId> = Pick<OperationDescriptor<TKey>, 'id' | 'method' | 'path' | 'audience' | 'targets' | 'responseMode' | 'idempotent' | 'timeout' | 'input' | 'output'> & Readonly<{ errorUnion: readonly string[] }>;

export function defineScopedOperation<TKey extends OperationId>(definition: Readonly<ScopedDescriptorInput<TKey>>): OperationDescriptor<TKey> {
  return Object.freeze({ ...definition, targets: Object.freeze([...definition.targets]), errorUnion: Object.freeze([...definition.errorUnion]) as readonly ApiErrorCode[] }) as OperationDescriptor<TKey>;
}
