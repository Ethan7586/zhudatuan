import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { CloneCompanyTemplate } from '../../03_application_yingyong/CloneCompanyTemplate';

describe('CloneCompanyTemplate internal application entry', () => {
  it('delegates one internal JSON command and returns independent target identities', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      clone_id: 'company-clone:one', business_number: 'SFLCOMPANY-ONE',
      source_realm_id: 'realm:source', source_mall_id: 'mall:source', source_line_id: 'line:source',
      source_node_id: 'node:source:l0', target_realm_id: 'realm:target', target_mall_id: 'mall:target',
      target_operating_entity_id: 'enterprise:target', target_line_id: 'line:target',
      target_node_id: 'node:target:l0', target_membership_id: 'membership:target',
      target_application_id: 'application:target', target_pool_id: 'pool:target',
      host_sovereign_node_id: 'node:source:l0', status: 'pending_bindings',
      infrastructure_action_count: 0, created_at: '2026-09-12T12:00:00.000Z', replayed: false,
    }] });
    const result = await new CloneCompanyTemplate().execute({ query } as unknown as OperationDatabase, {
      idempotencyKey: 'clone-one', sourceRealmId: 'realm:source', sourceMembershipId: 'membership:source',
      companyName: '目标公司', mallName: '目标商城', requestedBy: 'principal:owner', traceId: 'trace:clone-one',
    });

    expect(query).toHaveBeenCalledWith('select * from organization.clone_company_template($1::jsonb)', [
      JSON.stringify({ idempotency_key: 'clone-one', source_realm_id: 'realm:source',
        source_membership_id: 'membership:source', company_name: '目标公司', mall_name: '目标商城',
        requested_by: 'principal:owner', trace_id: 'trace:clone-one' }),
    ]);
    expect(result).toMatchObject({ targetRealmId: 'realm:target', targetMallId: 'mall:target',
      targetLineId: 'line:target', targetNodeId: 'node:target:l0', targetMembershipId: 'membership:target',
      status: 'pending_bindings', infrastructureActionCount: 0, replayed: false });
  });
});
