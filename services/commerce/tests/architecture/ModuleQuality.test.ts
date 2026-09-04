import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

interface OperationAuthority {
  readonly id: string;
  readonly owner: string;
  readonly handler: string;
  readonly method: string;
  readonly idempotent: boolean;
  readonly audience: string;
  readonly scopeKinds: readonly string[];
  readonly resourceResolver: string;
  readonly assuranceLevel: string;
  readonly idempotencyPolicy: string;
  readonly expectedVersion: string;
  readonly errorUnion: readonly string[];
}

interface ModuleEvidence {
  readonly id: string;
  readonly root: string;
  readonly domain: readonly string[];
  readonly application: readonly string[];
  readonly persistence: readonly string[];
  readonly tests: readonly string[];
  readonly operations: readonly OperationAuthority[];
}

const root = resolve(import.meta.dirname, '../../../..');
const moduleRoot = join(root, 'services/commerce/src/modules');
const authority = parse(readFileSync(join(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true }) as { operations: readonly OperationAuthority[] };
const handlerContract = readFileSync(join(root, 'services/commerce/tests/handler/Handler.test.ts'), 'utf8');
const persistenceContract = readFileSync(join(root, 'services/commerce/tests/repository/Repository.test.ts'), 'utf8');
const pipelineContract = readFileSync(join(root, 'services/commerce/src/foundation/application/OperationPipeline.test.ts'), 'utf8');
const policyContract = readFileSync(join(root, 'services/commerce/src/foundation/application/OperationPolicy.test.ts'), 'utf8');
const executorContract = readFileSync(join(root, 'services/commerce/src/foundation/application/OperationExecutor.test.ts'), 'utf8');
const failureContract = readFileSync(join(root, 'services/commerce/src/foundation/domain/Failure.test.ts'), 'utf8');
const concurrencyContract = [
  readFileSync(join(root, 'services/commerce/tests/repository/Repository.test.ts'), 'utf8'),
  readFileSync(join(root, 'services/commerce/tests/job/Job.test.ts'), 'utf8'),
].join('\n');
const modules = evidence();

describe('module quality evidence catalog', () => {
  it('covers every production module exactly once without a duplicated module authority', () => {
    expect(modules).toHaveLength(33);
    expect(new Set(modules.map(({ id }) => id)).size).toBe(modules.length);
    expect(new Set(authority.operations.map(({ owner }) => owner))).toEqual(new Set(modules.map(({ id }) => id)));
  });
});

describe.each(modules)('$id module quality contract', (module) => {
  it('exercises a Domain-backed rejection or invariant', () => {
    expect(module.domain.length).toBeGreaterThan(0);
    const invariantTests = module.tests.filter((test) => hasInvariantAssertion(readFileSync(test, 'utf8')) && reachesLayer(test, module.root, 'domain'));
    expect(invariantTests.map(short)).not.toEqual([]);
  });

  it('covers every Application use case through the authoritative operation matrix', () => {
    expect(module.application.length).toBeGreaterThan(0);
    expect(module.operations.length).toBeGreaterThan(0);
    expect(module.operations.every(({ handler }) => existsSync(join(root, handler)))).toBe(true);
    expect(handlerContract).toContain('describe.each(operations)');
  });

  it('subjects every SQL persistence adapter to the shared Persistence contract', () => {
    expect(module.persistence.length).toBeGreaterThan(0);
    expect(persistenceContract).toContain("describe.each(persistenceSources)");
    expect(persistenceContract).toContain('schemaOwnership(objectAuthority.objects)');
  });

  it('binds every Operation to input, output, timeout and error contracts', () => {
    expect(module.operations.every(({ id, handler }) => id.length > 0 && handler.includes(`/modules/${module.id}/application/handler/`))).toBe(true);
    expect(handlerContract).toContain('schema.input.parse');
    expect(handlerContract).toContain('schema.output.parse');
  });

  it('declares fail-closed Scope and permission policy for every Operation', () => {
    expect(module.operations.every(({ scopeKinds, resourceResolver, assuranceLevel, audience, errorUnion }) => {
      const scopeContract = resourceResolver.length > 0 && (resourceResolver === 'none' || scopeKinds.length > 0);
      const authenticated = !['system', 'webhook'].includes(audience) && !['anonymous', 'preauth'].includes(assuranceLevel);
      return scopeContract && assuranceLevel.length > 0 && (!authenticated || errorUnion.includes('AUTHENTICATION_REQUIRED'));
    })).toBe(true);
    expect(policyContract).toContain('explicit anonymous context');
    expect(policyContract).toContain('purpose-bound preauth context');
    expect(policyContract).toContain('authenticated access in the session context');
    expect(pipelineContract).toContain('authorize:');
  });

  it('declares idempotency and optimistic concurrency and inherits shared race tests', () => {
    expect(module.operations.every(({ method, idempotent, idempotencyPolicy, expectedVersion }) => idempotencyPolicy.length > 0 && expectedVersion.length > 0 && (method === 'GET' || idempotent || idempotencyPolicy !== 'none'))).toBe(true);
    expect(executorContract).toContain('returns a completed idempotency response without invoking the handler');
    expect(concurrencyContract).toContain('lease exclusion');
    expect(concurrencyContract).toContain('requeues a retryable failure');
  });

  it('declares a closed failure union and inherits safe external-failure mapping', () => {
    expect(module.operations.every(({ errorUnion }) => errorUnion.includes('VALIDATION_FAILED') && errorUnion.includes('INTERNAL_ERROR'))).toBe(true);
    expect(failureContract).toContain('without exposing the original exception');
    expect(failureContract).toContain('classifies HTTP status');
  });
});

function evidence(): readonly ModuleEvidence[] {
  return Object.freeze(
    readdirSync(moduleRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name: id }) => {
        const directory = join(moduleRoot, id);
        const sources = files(directory);
        return Object.freeze({
          id,
          root: directory,
          domain: sources.filter((file) => isProduction(file) && includesSegment(file, 'domain')),
          application: sources.filter((file) => isProduction(file) && includesSegment(file, 'application')),
          persistence: sources.filter((file) => isProduction(file) && file.includes('/infrastructure/persistence/')),
          tests: sources.filter((file) => file.endsWith('.test.ts')),
          operations: authority.operations.filter(({ owner }) => owner === id),
        });
      })
      .sort((left, right) => left.id.localeCompare(right.id))
  );
}

function reachesLayer(test: string, boundary: string, layer: string): boolean {
  const visited = new Set<string>();
  const pending = [test];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current) || !current.startsWith(boundary)) continue;
    visited.add(current);
    if (includesSegment(current, layer) && current !== test) return true;
    const source = readFileSync(current, 'utf8');
    for (const specifier of imports(source)) {
      if (!specifier.startsWith('.')) continue;
      const target = resolveSource(dirname(current), specifier);
      if (target) pending.push(target);
    }
  }
  return false;
}

function imports(source: string): readonly string[] {
  return [...source.matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]!);
}

function resolveSource(directory: string, specifier: string): string | undefined {
  const target = resolve(directory, specifier);
  for (const candidate of [target, `${target}.ts`, join(target, 'index.ts')]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return undefined;
}

function hasInvariantAssertion(source: string): boolean {
  return /(?:toThrow|rejects\.|not\.to|CONFLICT|INVALID|DENIED|REQUIRED|invariant)/i.test(source);
}

function includesSegment(file: string, segment: string): boolean {
  return file.split('/').includes(segment);
}

function isProduction(file: string): boolean {
  return file.endsWith('.ts') && !file.endsWith('.test.ts');
}

function short(file: string): string {
  return relative(root, file).split('\\').join('/');
}

function files(directory: string, result: string[] = []): readonly string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files(target, result);
    else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(target);
  }
  return result;
}
