import { describe, expect, it } from 'vitest';
import { OperationCatalog, operationSchema, type OperationId } from '@shop/contract';

const operations = Object.freeze([
  'approval.templates.create',
  'approval.templates.revise',
  'approval.templates.enable',
  'approval.templates.disable',
  'approval.templates.get',
  'approval.templates.list',
  'approval.tasks.list',
  'approval.tasks.approve',
  'approval.tasks.reject',
  'approval.instances.get',
] as const satisfies readonly OperationId[]);

describe('Approval fusion operation contract', () => {
  it('owns all ten LI semantics with exact schemas and executable handlers', () => {
    expect(operations).toHaveLength(10);
    for (const id of operations) {
      const operation = OperationCatalog.get(id);
      expect(operation.module).toBe('approval');
      expect(operationSchema(id).input).toBeDefined();
      expect(operationSchema(id).output).toBeDefined();
      expect(operation.lifecycle).toBe('active');
    }
  });

  it('treats approval decisions as the checker action instead of requiring a recursive action proof', () => {
    for (const id of ['approval.tasks.approve', 'approval.tasks.reject'] as const) {
      const operation = OperationCatalog.get(id);
      expect(operation.makerChecker).toBe(false);
      expect(operation.assuranceLevel).toBe('stepup');
      expect(operation.expectedVersion).toBe('required');
    }
  });
});
