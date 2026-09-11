import { describe, expect, it } from 'vitest';
import {
  ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION,
  parseAdministratorScopeChangeRequest,
} from './AdminSegmentScope';

describe('administrator segment scope contract', () => {
  it('keeps the two member segments distinct from member level and node profile', () => {
    expect(ADMIN_SEGMENT_SCOPE_SCHEMA_VERSION).toBe('sfl.admin-segment-scope.v1');
    expect(parseAdministratorScopeChangeRequest({
      action: 'grant',
      role_id: 'role:administrator',
      root_node_id: 'node:root:l0',
      segment: 'first_segment',
    })).toEqual({
      action: 'grant',
      role_id: 'role:administrator',
      root_node_id: 'node:root:l0',
      segment: 'first_segment',
    });
  });

  it('rejects free-form segments and client-supplied realm or line authority', () => {
    expect(() => parseAdministratorScopeChangeRequest({
      action: 'grant', role_id: 'role:administrator', root_node_id: 'node:root:l0', segment: 'L0-L5',
    })).toThrow('SFL_ADMIN_SEGMENT_INVALID');
    expect(() => parseAdministratorScopeChangeRequest({
      action: 'grant', role_id: 'role:administrator', root_node_id: 'node:root:l0',
      segment: 'first_segment', realm_id: 'realm:client-claim',
    })).toThrow('SFL_ADMIN_SCOPE_CHANGE_INVALID');
  });
});
