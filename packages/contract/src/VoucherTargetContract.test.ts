import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { errorStatus, OperationCatalog } from './index';

const target = OperationCatalog.frozen();
const matrix = readFileSync(new URL('../../../docs/voucher/Operations.md', import.meta.url), 'utf8');

describe('voucher target contract', () => {
  it('freezes exactly 74 target operations in the three owning contexts', () => {
    expect(target).toHaveLength(74);
    expect(countBy(target.map(({ module }) => module))).toEqual({ approval: 10, partner: 7, voucher: 57 });
    expect(OperationCatalog.all()).toHaveLength(250);
    expect(OperationCatalog.all().filter(({ module }) => module === 'voucher')).toHaveLength(19);
    expect(OperationCatalog.definitions()).toHaveLength(324);
  });

  it('publishes complete routes and explicit frozen policies without enabling runtime lookup', () => {
    expect(target.every(({ path }) => path.startsWith('/api/v1/'))).toBe(true);
    expect(target.every(({ availability, schema, summary }) => availability === 'frozen' && schema === 'structural' && summary.length > 0)).toBe(true);
    expect(new Set(target.map(({ id }) => id)).size).toBe(74);
    expect(new Set(target.map(({ method, path }) => `${method} ${path}`)).size).toBe(74);
    expect(target.filter(({ execution }) => execution === 'async')).toHaveLength(10);
    expect(target.filter(({ audience }) => audience === 'public')).toHaveLength(2);
    expect(target.filter(({ requirements }) => (requirements as readonly string[]).includes('MVP03'))).toHaveLength(10);
    expect(target.every(({ requirements }) => (requirements as readonly string[]).includes('MVP09') && (requirements as readonly string[]).includes('MVP18'))).toBe(true);
    expect(() => OperationCatalog.get('partner.customers.create')).toThrow('OPERATION_FROZEN');
    expect(OperationCatalog.definition('partner.customers.create').expectedVersion).toBe('none');
    expect(OperationCatalog.definition('partner.customers.update').expectedVersion).toBe('required');
  });

  it('generates availability, concurrency and async response semantics into OpenAPI', () => {
    const document = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as Openapi;
    const update = document.paths['/api/v1/partners/customers/{customerid}']?.patch;
    const submit = document.paths['/api/v1/vouchers/issue-orders/{orderid}/submit']?.post;
    expect(update).toMatchObject({
      operationId: 'partner.customers.update',
      'x-availability': 'frozen',
      'x-execution': 'sync',
      'x-idempotency': 'required',
      'x-expected-version': 'required',
    });
    expect(submit).toMatchObject({
      operationId: 'voucher.issueorders.submit',
      'x-availability': 'frozen',
      'x-execution': 'async',
      responses: { '202': expect.any(Object) },
    });
    expect(submit?.responses['200']).toBeUndefined();
  });

  it('publishes every frozen operation in OpenAPI with the matching execution response', () => {
    const document = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as Openapi;
    for (const operation of target) {
      const generated = document.paths[operation.path]?.[operation.method.toLowerCase()];
      expect(generated, operation.id).toMatchObject({
        operationId: operation.id,
        'x-availability': 'frozen',
        'x-execution': operation.execution,
        'x-idempotency': operation.idempotency,
        'x-expected-version': operation.expectedVersion,
      });
      expect(generated?.responses[operation.execution === 'async' ? '202' : '200'], operation.id).toBeDefined();
    }
  });

  it('keeps all frozen operations out of runtime controller and capability artifacts', () => {
    const controller = readFileSync(new URL('../../../services/commerce/src/foundation/interface/OperationController.ts', import.meta.url), 'utf8');
    const capabilities = readFileSync(new URL('../../../database/contracts/current.sql', import.meta.url), 'utf8');
    for (const { id } of target) {
      expect(controller, id).not.toContain(id);
      expect(capabilities, id).not.toContain(id);
    }
  });

  it('keeps the design-to-contract tracking matrix bound to every canonical definition', () => {
    const rows = new Map(matrix.split('\n').flatMap((line) => {
      const cells = line.split('|').slice(1, -1).map((value) => value.trim());
      const id = unquote(cells[1] ?? '');
      if (!/^(?:approval|partner|voucher)\.[a-z.]+$/.test(id) || !/^(?:GET|POST|PUT|PATCH|DELETE) \/api\/v1\//.test(unquote(cells[2] ?? ''))) return [];
      return [[id, {
        route: unquote(cells[2]!),
        permission: cells[3] === '—' ? undefined : unquote(cells[3]!),
        policy: unquote(cells[4]!),
        requirements: unquote(cells[5]!),
      }] as const];
    }));
    expect([...rows.keys()].sort()).toEqual(target.map(({ id }) => id).sort());
    for (const operation of target) {
      expect(rows.get(operation.id)).toEqual({
        route: `${operation.method} ${operation.path}`,
        permission: operation.permission,
        policy: `${operation.idempotent} · ${operation.idempotency} · ${operation.expectedVersion} · ${operation.execution}`,
        requirements: operation.requirements.join(','),
      });
    }
  });

  it('publishes the frozen target business failures with stable HTTP semantics', () => {
    expect([
      'CUSTOMER_NOT_FOUND', 'PRODUCT_DISABLED', 'PRODUCT_VERSION_STALE', 'CREDENTIAL_SHORTAGE', 'STOCK_EXHAUSTED',
      'APPROVAL_NOT_ASSIGNED', 'APPROVAL_ALREADY_DECIDED', 'ISSUE_ORDER_LOCKED', 'VOUCHER_STATE_CONFLICT',
      'VOUCHER_EXPIRED', 'VOUCHER_DISABLED', 'VOUCHER_VOID', 'INSUFFICIENT_BALANCE', 'REDEMPTION_DUPLICATE', 'VERSION_CONFLICT',
    ].map(errorStatus)).toEqual([404, 409, 409, 409, 409, 403, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
  });

  it('registers every contract and SDK guard introduced by the frozen target', () => {
    expect([
      'OPERATION_FROZEN', 'OPERATION_SUMMARY_INVALID', 'SDK_EXPECTED_VERSION_REQUIRED', 'SDK_OPERATION_FROZEN',
    ].map(errorStatus)).toEqual([409, 500, 400, 409]);
  });
});

function countBy(values: readonly string[]): Readonly<Record<string, number>> {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]));
}

function unquote(value: string): string {
  return value.replace(/^`|`$/g, '');
}

interface OpenapiOperation {
  readonly operationId: string;
  readonly responses: Readonly<Record<string, unknown>>;
  readonly [key: `x-${string}`]: unknown;
}

interface Openapi {
  readonly paths: Readonly<Record<string, Readonly<Record<string, OpenapiOperation>>>>;
}
