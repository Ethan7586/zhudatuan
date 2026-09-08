import type { Operation } from '@shop/contract';

export class ResourceResolver {
  resolve(operation: Operation, input: Readonly<object>): string | undefined {
    if (operation.resourceResolver === 'none' || operation.resourceParameter === null) return undefined;
    const path = Reflect.get(input, 'path');
    if (path === null || typeof path !== 'object') return undefined;
    const value = Reflect.get(path, operation.resourceParameter);
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }
}
