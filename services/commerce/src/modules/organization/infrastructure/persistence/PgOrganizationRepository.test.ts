import { describe, expect, it, vi } from 'vitest';
import type { PgTransactionAccess, SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgOrganizationRepository } from './PgOrganizationRepository';
import { Organization } from '../../domain/model/Organization';
import { Mall } from '../../domain/model/Mall';
import { Membership } from '../../domain/model/Membership';
import { completeOpening } from '../../test/MallFixture';

const context = {} as ReadTransactionContext;

describe('PgOrganizationRepository', () => {
  it('returns the readable parent name with every visible organization in one query', async () => {
    const rows = [{ id: 'enterprise:one', parent_id: 'platform:one', parent_name: '福利商城平台', name: '鸿泰集团' }];
    const database = { query: vi.fn(async () => ({ rows, rowCount: rows.length, command: '', oid: 0, fields: [] })) } as unknown as SqlExecutor;
    const repository = new PgOrganizationRepository({ database: () => database } as unknown as PgTransactionAccess);

    await expect(repository.layers(context, { scope: 'platform:one', after: null, fetch: 51 })).resolves.toEqual(rows);
    expect(database.query).toHaveBeenCalledWith(expect.stringMatching(/left join organization\.organization parent on parent\.id=child\.parent_id/), ['platform:one', null, 51]);
  });

  it('rereads every persisted mall field through the authorized hierarchy boundary', async () => {
    const row = mallRow();
    const database = { query: vi.fn(async () => result([row])) } as unknown as SqlExecutor;
    const repository = new PgOrganizationRepository({ database: () => database } as unknown as PgTransactionAccess);
    const mall = await repository.mall(context, row.id, 'tenant:one');

    expect(mall.view()).toEqual({
      id: 'mall:one', parentId: 'enterprise:one', name: '主打团福利商城', code: 'WELFARE01', publicSlug: 'welfare-one', brandName: '主打团',
      domain: { mode: 'custom', customDomain: 'mall.example.com' }, ownerMembershipId: 'membership:owner', timezone: 'Asia/Shanghai', currency: 'CNY',
      theme: { preset: 'shop', primaryColor: '#E8502A', accentColor: '#FF8A34', logoObjectRef: 'object:logo', faviconObjectRef: null }, opening: completeOpening,
      status: 'draft', version: 1, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z',
    });
    expect(vi.mocked(database.query).mock.calls[0]?.[0]).toContain('visible.ancestor_id=$2');
  });

  it('conceals a mall outside the caller scope', async () => {
    const database = { query: vi.fn(async () => result([])) } as unknown as SqlExecutor;
    const repository = new PgOrganizationRepository({ database: () => database } as unknown as PgTransactionAccess);
    await expect(repository.mall(context, 'mall:foreign', 'tenant:one')).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('organization.unitclosure visible'), ['mall:foreign', 'tenant:one']);
  });

  it('maps a unique code violation to the canonical field error', async () => {
    const database = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('insert into organization.mall')) throw Object.assign(new Error('duplicate'), { code: '23505', constraint: 'organization_mall_code_unique' });
        return result([{ id: 'ok' }], 1);
      }),
    } as unknown as SqlExecutor;
    const repository = new PgOrganizationRepository({ database: () => database } as unknown as PgTransactionAccess);
    const parent = new Organization({ id: 'enterprise:one', kind: 'enterprise', parentid: 'tenant:one', name: '示范企业', timezone: 'Asia/Shanghai', status: 'active', malllimit: 10, version: 2, createdat: now, updatedat: now });
    const organization = parent.allocateMall({ id: 'mall:one', name: '主打团福利商城', timezone: 'Asia/Shanghai', now });
    const mall = new Mall({ organization, code: 'WELFARE01', publicSlug: 'welfare-one', brandName: '主打团', domain: { mode: 'platform' }, ownerMembershipId: 'membership:owner', currency: 'CNY', theme: { preset: 'shop', primaryColor: '#E8502A', accentColor: '#FF8A34', logoObjectRef: null, faviconObjectRef: null }, opening: completeOpening, version: 1, createdat: now, updatedat: now });
    const owner = Membership.owner('organizationmembership:one', mall.organization.id, mall.ownerMembershipId, now);
    await expect(repository.createMall(context as never, { parent, mall, owner, expectedParentVersion: 2 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { field: 'code' } });
  });

  it.each([
    ['organization_mall_slug_unique', 'publicSlug'],
    ['organization_mall_domain_unique', 'customDomain'],
  ])('maps %s to the canonical %s field without leaking database details', async (constraint, field) => {
    const database = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('insert into organization.mall')) throw Object.assign(new Error('sensitive database detail'), { code: '23505', constraint });
        return result([{ id: 'ok' }], 1);
      }),
    } as unknown as SqlExecutor;
    const repository = new PgOrganizationRepository({ database: () => database } as unknown as PgTransactionAccess);
    const parent = new Organization({ id: 'enterprise:one', kind: 'enterprise', parentid: 'tenant:one', name: '示范企业', timezone: 'Asia/Shanghai', status: 'active', malllimit: 10, version: 2, createdat: now, updatedat: now });
    const organization = parent.allocateMall({ id: 'mall:one', name: '主打团福利商城', timezone: 'Asia/Shanghai', now });
    const mall = new Mall({ organization, code: 'WELFARE01', publicSlug: 'welfare-one', brandName: '主打团', domain: { mode: 'custom', customDomain: 'mall.example.com' }, ownerMembershipId: 'membership:owner', currency: 'CNY', theme: { preset: 'shop', primaryColor: '#E8502A', accentColor: '#FF8A34', logoObjectRef: null, faviconObjectRef: null }, opening: completeOpening, version: 1, createdat: now, updatedat: now });
    const owner = Membership.owner('organizationmembership:one', mall.organization.id, mall.ownerMembershipId, now);
    await expect(repository.createMall(context as never, { parent, mall, owner, expectedParentVersion: 2 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED', details: { field } });
  });
});

const now = '2026-09-04T00:00:00.000Z';
function result(rows: readonly Record<string, unknown>[], rowCount = rows.length) {
  return { rows: [...rows], rowCount, command: '', oid: 0, fields: [] };
}
function mallRow() {
  return {
    id: 'mall:one', parent_id: 'enterprise:one', name: '主打团福利商城', timezone: 'Asia/Shanghai', status: 'draft', organization_version: '1', mall_limit: '0',
    code: 'WELFARE01', public_slug: 'welfare-one', brand_name: '主打团', domain_mode: 'custom', custom_domain: 'mall.example.com',
    owner_membership_id: 'membership:owner', currency: 'CNY', theme_preset: 'shop', theme_primary_color: '#E8502A', theme_accent_color: '#FF8A34',
    theme_logo_object_ref: 'object:logo', theme_favicon_object_ref: null,
    opening_state: 'complete', subject_type: 'enterprise', company_name: completeOpening.subject.companyName, credit_code: completeOpening.subject.creditCode,
    legal_representative: completeOpening.subject.legalRepresentative, contact_name: completeOpening.subject.contactName, contact_mobile: completeOpening.subject.contactMobile,
    license_object_ref: completeOpening.subject.licenseObjectRef, store_type: completeOpening.business.storeType, primary_category: completeOpening.business.primaryCategory,
    business_mode: completeOpening.business.mode, business_region: completeOpening.business.region, business_address: completeOpening.business.address, service_phone: completeOpening.business.servicePhone,
    certificate_mode: completeOpening.certificateMode, certificate_object_ref: completeOpening.certificateObjectRef, mini_program_mode: completeOpening.channels.miniProgramMode,
    mini_program_app_id: null, mini_program_original_id: null, official_account_mode: completeOpening.channels.officialAccountMode, official_account_app_id: null, video_channel_id: null,
    payment_plan: completeOpening.payment.plan, wechat_merchant_id: null, delivery_mode: completeOpening.fulfillment.deliveryMode, warehouse_region: completeOpening.fulfillment.warehouseRegion,
    return_contact: completeOpening.fulfillment.returnContact, return_address: completeOpening.fulfillment.returnAddress, invoice_mode: completeOpening.invoiceMode,
    notification_contact: completeOpening.notificationContact, version: '1', created_at: new Date(now), updated_at: new Date(now),
  } as const;
}
