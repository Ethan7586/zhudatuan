import { OP_RUNTIME_EXPORTS_READ, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_JOBS_READ } from '@shop/contract/ids';
import { describe, expect, it } from 'vitest';
import { taskFilter, taskReadOperation } from './TaskState';

describe('Task state', () => {
  it('authorizes each workspace through its own read operation', () => {
    expect(taskReadOperation()).toBe(OP_RUNTIME_JOBS_READ);
    expect(taskReadOperation({ type: 'import' })).toBe(OP_RUNTIME_IMPORTS_READ);
    expect(taskReadOperation({ type: 'export' })).toBe(OP_RUNTIME_EXPORTS_READ);
  });

  it('accepts only catalog task filters and stable page sizes', () => {
    expect(taskFilter(new URLSearchParams('type=import&state=failed&owner=voucher&limit=50'))).toEqual({ type: 'import', state: 'failed', owner: 'voucher', limit: 50 });
    expect(taskFilter(new URLSearchParams('type=unknown&owner=../unsafe&limit=999'))).toEqual({ limit: 20 });
  });
});
