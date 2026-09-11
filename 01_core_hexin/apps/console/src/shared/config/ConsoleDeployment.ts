export const CONSOLE_VERSION_SCHEMA = 'zdt.console-version.v1' as const;

export interface ConsoleVersion {
  readonly schema: typeof CONSOLE_VERSION_SCHEMA;
  readonly sourceBranch: string;
  readonly sourceSha: string;
  readonly builtAt: string;
  readonly sourceTree: 'clean' | 'dirty';
  readonly buildId: string;
}

export function createConsoleVersion(source: Omit<ConsoleVersion, 'schema'>): ConsoleVersion {
  return parseConsoleVersion({ schema: CONSOLE_VERSION_SCHEMA, ...source });
}

export function parseConsoleVersion(value: unknown): ConsoleVersion {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('CONSOLE_VERSION_INVALID');
  const source = value as Record<string, unknown>;
  if (source.schema !== CONSOLE_VERSION_SCHEMA) throw new Error('CONSOLE_VERSION_SCHEMA_INVALID');
  const sourceBranch = requiredText(source.sourceBranch, 'CONSOLE_VERSION_BRANCH_INVALID');
  const sourceSha = requiredText(source.sourceSha, 'CONSOLE_VERSION_SHA_INVALID');
  const builtAt = requiredText(source.builtAt, 'CONSOLE_VERSION_BUILT_AT_INVALID');
  const sourceTree = source.sourceTree;
  const buildId = requiredText(source.buildId, 'CONSOLE_VERSION_BUILD_ID_INVALID');
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('CONSOLE_VERSION_SHA_INVALID');
  if (Number.isNaN(Date.parse(builtAt))) throw new Error('CONSOLE_VERSION_BUILT_AT_INVALID');
  if (sourceTree !== 'clean' && sourceTree !== 'dirty') throw new Error('CONSOLE_VERSION_SOURCE_TREE_INVALID');
  return Object.freeze({ schema: CONSOLE_VERSION_SCHEMA, sourceBranch, sourceSha, builtAt, sourceTree, buildId });
}

function requiredText(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(code);
  return value.trim();
}
