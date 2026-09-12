import { describe, expect, it, vi } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CompanyTemplateClone } from '../../03_application_yingyong/CloneCompanyTemplate';
import { CompanyTemplateCloneWorkflow } from '../../03_application_yingyong/CompanyTemplateCloneWorkflow';

describe('CompanyTemplateCloneWorkflow internal boundary', () => {
  it('keeps the batch 15 adapter outside the clone kernel', async () => {
    const clone: CompanyTemplateClone = Object.freeze({
      cloneId: 'company-clone:one', businessNumber: 'SFLCOMPANY-ONE', sourceRealmId: 'realm:source',
      sourceMallId: 'mall:source', sourceLineId: 'line:source', sourceNodeId: 'node:source:l0',
      targetRealmId: 'realm:target', targetMallId: 'mall:target', targetOperatingEntityId: 'enterprise:target',
      targetLineId: 'line:target', targetNodeId: 'node:target:l0', targetMembershipId: 'membership:target',
      targetApplicationId: 'application:target', targetPoolId: 'pool:target', hostSovereignNodeId: 'node:source:l0',
      status: 'pending_bindings', infrastructureActionCount: 0, createdAt: '2026-09-12T12:00:00.000Z', replayed: false,
    });
    const application = { execute: vi.fn().mockResolvedValue(clone) };
    const database = {} as OperationDatabase;
    const input = Object.freeze({
      idempotencyKey: 'company-clone:one', sourceRealmId: 'realm:source',
      sourceMembershipId: 'membership:source', companyName: '目标公司', mallName: '目标商城',
      requestedBy: 'principal:owner', traceId: 'trace:company-clone:one',
    });

    await expect(new CompanyTemplateCloneWorkflow(application).execute(database, input)).resolves.toBe(clone);
    expect(application.execute).toHaveBeenCalledOnce();
    expect(application.execute).toHaveBeenCalledWith(database, input);
  });
});
