import assert from 'node:assert/strict';
import test from 'node:test';
import { OperationCatalog } from '@shop/contract';
import { EMPLOYEE_PERMISSIONS } from './RolePermissions';

test('local employee permissions use only current operation permissions', () => {
  const current = new Set(OperationCatalog.all().flatMap((operation) => (operation.permission ? [operation.permission] : [])));
  assert.deepEqual(
    EMPLOYEE_PERMISSIONS.filter((permission) => !current.has(permission)),
    []
  );
  assert.equal(EMPLOYEE_PERMISSIONS.includes('voucher.binding.read' as never), false);
});
