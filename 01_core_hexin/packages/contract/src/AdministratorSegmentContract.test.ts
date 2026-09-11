import { describe, expect, it } from 'vitest';
import { OperationCatalog } from './OperationCatalog';

describe('administrator segment operations', () => {
  it('publishes versioned read, detail, scope and representative write contracts', () => {
    expect(OperationCatalog.get('access.administrators.members.read')).toMatchObject({
      method: 'GET', path: '/api/v1/access/administrator-members', audience: 'operator', permission: 'member.read',
    });
    expect(OperationCatalog.get('access.administrators.member.read')).toMatchObject({
      method: 'GET', path: '/api/v1/access/administrator-members/{nodeid}', permission: 'member.read',
    });
    expect(OperationCatalog.get('access.administrators.scopes.manage')).toMatchObject({
      method: 'PUT', path: '/api/v1/access/administrators/{membershipid}/segment-scope',
      permission: 'access.scope.manage', idempotency: 'required',
    });
    expect(OperationCatalog.get('access.administrators.members.note')).toMatchObject({
      method: 'POST', path: '/api/v1/access/administrator-members/{nodeid}/notes',
      permission: 'member.manage', idempotency: 'required',
    });
  });
});
