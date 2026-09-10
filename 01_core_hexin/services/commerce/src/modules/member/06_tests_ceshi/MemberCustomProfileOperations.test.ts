import { PGlite } from '@electric-sql/pglite';
import { StorefrontMemberCustomProfileSchema, StorefrontMemberProfileConfigSchema } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { memberCustomProfileActions } from '../03_application_yingyong/MemberCustomProfileOperations';

describe('storefront member custom profile', () => {
  it('stores seven field types and isolates values by mall', async () => {
    const db = new PGlite();
    try {
      await db.exec(`create schema member;create schema access;create schema identity;create schema ordering;create schema referral;
  create table member.profile(id text primary key,mobile_token text);create table access.membership(id text primary key,member_id text,organization_id text,client text,status text);
  create table identity.federatedidentity(membership_id text,provider text,status text);create table ordering.orderrecord(mall_id text,member_id text);
  create table referral.member(id text,scope_id text,member_id text);create table referral.binding(scope_id text,referral_member_id text);
  create table member.storefrontcustomtag(organization_id text,id text,name text,color text,sort_order int,enabled bool,updated_at timestamptz,primary key(organization_id,id));
  create table member.storefrontcustomfield(organization_id text,id text,name text,field_type text,options jsonb,sort_order int,enabled bool,updated_at timestamptz,primary key(organization_id,id));
  create table member.storefrontmembertag(organization_id text,membership_id text,tag_id text,primary key(organization_id,membership_id,tag_id));
  create table member.storefrontmemberfieldvalue(organization_id text,membership_id text,field_id text,value jsonb,updated_at timestamptz,primary key(organization_id,membership_id,field_id));
  insert into member.profile values('member:one','token'),('member:two',null);insert into access.membership values('membership:one','member:one','mall:one','storefront','active'),('membership:two','member:two','mall:two','storefront','active');
  insert into identity.federatedidentity values('membership:one','wechat','active');insert into ordering.orderrecord values('mall:one','member:one');insert into referral.member values('referral:one','mall:one','member:one');insert into referral.binding values('mall:one','referral:one');`);
      const a = memberCustomProfileActions(),
        manageConfig = a['member.storefront.config.manage'],
        readConfig = a['member.storefront.config.read'],
        manage = a['member.storefront.custom.manage'],
        read = a['member.storefront.custom.read'];
      if (typeof manageConfig !== 'function' || typeof readConfig !== 'function' || typeof manage !== 'function' || typeof read !== 'function') throw new Error('MISSING');
      const defs = [
        ['text', []],
        ['number', []],
        ['date', []],
        ['select', ['金卡', '银卡']],
        ['multiselect', ['母婴', '食品']],
        ['switch', []],
        ['remark', []],
      ] as const;
      const config = {
        tags: [{ id: 'tag:vip', name: '重点会员', color: 'purple' as const, sort_order: 0, enabled: true }],
        fields: defs.map(([type, options], i) => ({ id: `field:${type}`, name: `字段 ${i + 1}`, type, options: [...options], sort_order: i, enabled: true })),
      };
      expect(StorefrontMemberProfileConfigSchema.parse((await manageConfig(req('member.storefront.config.manage', 'mall:one', undefined, config), db as unknown as OperationDatabase)).body)).toEqual(config);
      expect((await readConfig(req('member.storefront.config.read', 'mall:two'), db as unknown as OperationDatabase)).body).toEqual({ tags: [], fields: [] });
      const update = {
        custom_tag_ids: ['tag:vip'],
        custom_field_values: [
          { field_id: 'field:text', value: '华东' },
          { field_id: 'field:number', value: 12 },
          { field_id: 'field:date', value: '2026-09-11' },
          { field_id: 'field:select', value: '银卡' },
          { field_id: 'field:multiselect', value: ['母婴', '食品'] },
          { field_id: 'field:switch', value: true },
          { field_id: 'field:remark', value: '周末送货' },
        ],
      };
      const saved = StorefrontMemberCustomProfileSchema.parse((await manage(req('member.storefront.custom.manage', 'mall:one', 'membership:one', update), db as unknown as OperationDatabase)).body);
      expect(saved.custom_field_values).toEqual(update.custom_field_values);
      expect(saved.system_tags.map((v) => v.code)).toEqual(['active_member', 'mobile_bound', 'purchased', 'referrer', 'wechat_bound']);
      await expect(read(req('member.storefront.custom.read', 'mall:two', 'membership:one'), db as unknown as OperationDatabase)).rejects.toThrow('RESOURCE_NOT_FOUND');
      const stored = await db.query<{ organization_id: string; membership_id: string }>('select organization_id,membership_id from member.storefrontmemberfieldvalue');
      expect(stored.rows).toHaveLength(7);
      expect(stored.rows.every((r) => r.organization_id === 'mall:one' && r.membership_id === 'membership:one')).toBe(true);
    } finally {
      await db.close();
    }
  });
});
function req(type: OperationRequest['type'], scope: string, membershipid?: string, body: unknown = null): OperationRequest {
  return {
    type,
    access: { scope: { id: scope, kind: 'mall' } },
    input: { path: membershipid ? { membershipid } : {}, query: {}, headers: {}, body, rawBody: '', deadline: Date.now() + 5000, signal: new AbortController().signal },
  } as unknown as OperationRequest;
}
