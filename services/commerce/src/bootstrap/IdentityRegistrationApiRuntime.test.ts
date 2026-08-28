import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { assertIdentityRegistrationRuntimeCompatibility } from './IdentityRegistrationApiRuntime';

describe('identity registration API runtime', () => {
  it('requires the dedicated writable registration database role and registration relations', async () => {
    const healthy = { current_user: 'zhudatuanidentityapi', writable: true, schema: true, contract: true, registration: true, relations: true };
    const pool = (state: typeof healthy) => ({ query: async () => result([state], 1) }) as unknown as DatabasePool;
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, current_user: 'shopjob' })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, relations: false })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertIdentityRegistrationRuntimeCompatibility(pool({ ...healthy, registration: false })))
      .rejects.toThrow('IDENTITY_REGISTRATION_RUNTIME_COMPATIBILITY_FAILED');
  });
});

function result(rows: readonly unknown[], rowCount: number) {
  return { rows, rowCount, command: '', oid: 0, fields: [] };
}
