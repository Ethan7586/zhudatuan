import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

interface OperationAuthority {
  readonly id: string;
  readonly owner: string;
  readonly handler: string;
  readonly method: string;
  readonly requestSchema: string;
  readonly responseSchema: string;
  readonly errorUnion: readonly string[];
  readonly assuranceLevel: string;
  readonly idempotencyPolicy: string;
  readonly timeout: number;
}

const root = resolve(import.meta.dirname, '../../../..');
const authority = parse(readFileSync(join(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true }) as { operations: readonly OperationAuthority[] };
const operations = authority.operations;
const executor = readFileSync(join(root, 'services/commerce/src/foundation/application/OperationExecutor.ts'), 'utf8');
const pipeline = readFileSync(join(root, 'services/commerce/src/foundation/application/OperationPipeline.ts'), 'utf8');

describe('single-use-case Handler contract', () => {
  it('covers the complete authoritative operation catalog', () => {
    expect(operations).toHaveLength(270);
    expect(new Set(operations.map(({ id }) => id)).size).toBe(270);
    expect(new Set(operations.map(({ handler }) => handler)).size).toBe(270);
  });

  describe.each(operations)('$id', (operation) => {
    const handlerPath = join(root, operation.handler);
    const handlerName = basename(operation.handler, '.ts');
    const modulePath = join(root, 'services/commerce/src/modules', operation.owner, 'Module.ts');

    it('declares one exact use-case identity and transaction mode', () => {
      expect(existsSync(handlerPath)).toBe(true);
      const source = readFileSync(handlerPath, 'utf8');
      expect(source.match(new RegExp(`export class ${handlerName}\\b`, 'g'))).toHaveLength(1);
      expect(source).toContain(`readonly operation = '${operation.id}' as const`);
      expect(source).toMatch(/readonly mode = '(?:read|write)' as const/);
      expect(source).toMatch(/(?:async\s+)?(?:execute|commit)\s*\(/);
    });

    it('contains explicit orchestration without generic dispatch or SQL', () => {
      const source = readFileSync(handlerPath, 'utf8');
      expect(source).not.toMatch(/defineOperationHandler|OperationUsecase|\.invoke\s*\(/);
      expect(source).not.toMatch(/\.query\s*\(|\bselect\s+.+\s+from|\binsert\s+into|\bupdate\s+[a-z]|\bdelete\s+from/is);
      expect(source).not.toMatch(/PgTransactionAccess|DatabasePool|QueryResult|PoolClient/);
    });

    it('is assembled exactly once by its owning module', () => {
      const module = readFileSync(modulePath, 'utf8');
      expect(module.match(new RegExp(`new ${handlerName}\\s*\\(`, 'g'))).toHaveLength(1);
      expect(module).toMatch(new RegExp(`from ['\"][^'\"]*${handlerName}['\"]`));
    });

    it('inherits fail-closed validation, security, idempotency, deadline, audit and output checks', () => {
      expect(operation.requestSchema).toBeTruthy();
      expect(operation.responseSchema).toBeTruthy();
      expect(operation.errorUnion).toContain('VALIDATION_FAILED');
      expect(operation.timeout).toBeGreaterThan(0);
      expect(operation.assuranceLevel).toBeTruthy();
      expect(operation.idempotencyPolicy).toBeTruthy();
      expect(pipeline).toContain('schema.input.parse');
      expect(pipeline).toContain('schema.output.parse');
      expect(pipeline).toContain('this.policy.authorize');
      expect(executor).toContain('this.idempotency');
      expect(executor).toContain('this.audit');
    });
  });
});
