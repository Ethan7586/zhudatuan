import { RUNTIME_IMPORT_OWNERS } from '@shop/contract';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { defineQueryState, optionalEnumQuery, optionalQuery } from '../query/QueryState';
import { scopeRoutePath } from '../url/ScopePath';

export type ImportOwner = (typeof RUNTIME_IMPORT_OWNERS)[number];

const query = defineQueryState({ newimport: optionalEnumQuery(RUNTIME_IMPORT_OWNERS), pool: optionalQuery(255) });

export function taskImportPath(context: ConsoleContext, kind: ImportOwner, pool?: string): string {
  const search = query.create({ newimport: kind, pool });
  return `${scopeRoutePath(context.scope, 'consoletasks')}?${search.toString()}`;
}

export function readTaskImport(search: URLSearchParams): Readonly<{ kind?: ImportOwner; pool?: string }> {
  const value = query.read(search);
  return Object.freeze({ ...(value.newimport === undefined ? {} : { kind: value.newimport }), ...(value.pool === undefined ? {} : { pool: value.pool }) });
}

export function clearTaskImport(search: URLSearchParams): URLSearchParams {
  return query.reset(search);
}
