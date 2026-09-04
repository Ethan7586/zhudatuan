import type { QueryResultRow } from 'pg';
import { databaseInteger } from '../../../../foundation/persistence/DatabaseInteger';
import { Mall } from '../../domain/model/Mall';
import { Organization, type OrganizationKind, type OrganizationStatus } from '../../domain/model/Organization';

export interface MallRow extends QueryResultRow {
  readonly id: string;
  readonly parent_id: string;
  readonly name: string;
  readonly timezone: string;
  readonly status: OrganizationStatus;
  readonly organization_version: unknown;
  readonly mall_limit: unknown;
  readonly code: string;
  readonly public_slug: string;
  readonly brand_name: string;
  readonly domain_mode: 'platform' | 'custom';
  readonly custom_domain: string | null;
  readonly owner_membership_id: string;
  readonly currency: string;
  readonly theme_preset: 'shop' | 'market' | 'governance';
  readonly theme_primary_color: string;
  readonly theme_accent_color: string;
  readonly theme_logo_object_ref: string | null;
  readonly theme_favicon_object_ref: string | null;
  readonly opening_state: 'complete' | 'actionrequired';
  readonly subject_type: 'enterprise' | 'individual' | 'organization' | 'personal';
  readonly company_name: string | null;
  readonly credit_code: string | null;
  readonly legal_representative: string | null;
  readonly contact_name: string | null;
  readonly contact_mobile: string | null;
  readonly license_object_ref: string | null;
  readonly store_type: 'general' | 'specialty' | 'franchise' | 'government';
  readonly primary_category: string | null;
  readonly business_mode: 'selfoperated' | 'marketplace' | 'hybrid';
  readonly business_region: string | null;
  readonly business_address: string | null;
  readonly service_phone: string | null;
  readonly certificate_mode: 'managed' | 'self' | 'later';
  readonly certificate_object_ref: string | null;
  readonly mini_program_mode: 'later' | 'authorize' | 'register';
  readonly mini_program_app_id: string | null;
  readonly mini_program_original_id: string | null;
  readonly official_account_mode: 'later' | 'authorize' | 'register';
  readonly official_account_app_id: string | null;
  readonly video_channel_id: string | null;
  readonly payment_plan: 'later' | 'wechat' | 'multi' | 'offline';
  readonly wechat_merchant_id: string | null;
  readonly delivery_mode: 'express' | 'local' | 'pickup' | 'digital' | 'mixed';
  readonly warehouse_region: string | null;
  readonly return_contact: string | null;
  readonly return_address: string | null;
  readonly invoice_mode: 'later' | 'electronic' | 'paper' | 'both';
  readonly notification_contact: string | null;
  readonly version: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export interface OrganizationRow extends QueryResultRow {
  readonly id: string;
  readonly kind: OrganizationKind;
  readonly parent_id: string | null;
  readonly name: string;
  readonly timezone: string;
  readonly status: OrganizationStatus;
  readonly mall_limit: unknown;
  readonly version: unknown;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export const mallColumns = `organization.id,organization.parent_id,organization.name,organization.timezone,organization.status,
  organization.version organization_version,organization.mall_limit,mall.code,mall.public_slug,mall.brand_name,mall.domain_mode,
  mall.custom_domain,mall.owner_membership_id,mall.currency,mall.theme_preset,mall.theme_primary_color,mall.theme_accent_color,
  mall.theme_logo_object_ref,mall.theme_favicon_object_ref,mall.opening_state,mall.subject_type,mall.company_name,mall.credit_code,
  mall.legal_representative,mall.contact_name,mall.contact_mobile,mall.license_object_ref,mall.store_type,mall.primary_category,
  mall.business_mode,mall.business_region,mall.business_address,mall.service_phone,mall.certificate_mode,mall.certificate_object_ref,
  mall.mini_program_mode,mall.mini_program_app_id,mall.mini_program_original_id,mall.official_account_mode,mall.official_account_app_id,
  mall.video_channel_id,mall.payment_plan,mall.wechat_merchant_id,mall.delivery_mode,mall.warehouse_region,mall.return_contact,
  mall.return_address,mall.invoice_mode,mall.notification_contact,mall.version,mall.created_at,mall.updated_at`;

export function mapOrganization(row: OrganizationRow): Organization {
  return new Organization({
    id: row.id,
    kind: row.kind,
    parentid: row.parent_id,
    name: row.name,
    timezone: row.timezone,
    status: row.status,
    malllimit: databaseInteger(row.mall_limit),
    version: databaseInteger(row.version),
    createdat: iso(row.created_at),
    updatedat: iso(row.updated_at),
  });
}

export function mapMall(row: MallRow): Mall {
  const organization = new Organization({
    id: row.id,
    kind: 'mall',
    parentid: row.parent_id,
    name: row.name,
    timezone: row.timezone,
    status: row.status,
    malllimit: databaseInteger(row.mall_limit),
    version: databaseInteger(row.organization_version),
    createdat: iso(row.created_at),
    updatedat: iso(row.updated_at),
  });
  return new Mall({
    organization,
    code: row.code,
    publicSlug: row.public_slug,
    brandName: row.brand_name,
    domain: row.domain_mode === 'custom' ? Object.freeze({ mode: 'custom', customDomain: required(row.custom_domain) }) : Object.freeze({ mode: 'platform' }),
    ownerMembershipId: row.owner_membership_id,
    currency: row.currency,
    theme: Object.freeze({ preset: row.theme_preset, primaryColor: row.theme_primary_color, accentColor: row.theme_accent_color, logoObjectRef: row.theme_logo_object_ref, faviconObjectRef: row.theme_favicon_object_ref }),
    opening: Object.freeze({
      state: row.opening_state,
      subject: Object.freeze({ type: row.subject_type, companyName: row.company_name, creditCode: row.credit_code, legalRepresentative: row.legal_representative, contactName: row.contact_name, contactMobile: row.contact_mobile, licenseObjectRef: row.license_object_ref }),
      business: Object.freeze({ storeType: row.store_type, primaryCategory: row.primary_category, mode: row.business_mode, region: row.business_region, address: row.business_address, servicePhone: row.service_phone }),
      certificateMode: row.certificate_mode,
      certificateObjectRef: row.certificate_object_ref,
      channels: Object.freeze({ miniProgramMode: row.mini_program_mode, miniProgramAppId: row.mini_program_app_id, miniProgramOriginalId: row.mini_program_original_id, officialAccountMode: row.official_account_mode, officialAccountAppId: row.official_account_app_id, videoChannelId: row.video_channel_id }),
      payment: Object.freeze({ plan: row.payment_plan, wechatMerchantId: row.wechat_merchant_id }),
      fulfillment: Object.freeze({ deliveryMode: row.delivery_mode, warehouseRegion: row.warehouse_region, returnContact: row.return_contact, returnAddress: row.return_address }),
      invoiceMode: row.invoice_mode,
      notificationContact: row.notification_contact,
    }),
    version: databaseInteger(row.version),
    createdat: iso(row.created_at),
    updatedat: iso(row.updated_at),
  });
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) throw new Error('ORGANIZATION_TIME_INVALID');
  return date.toISOString();
}

function required(value: string | null): string {
  if (!value) throw new Error('ORGANIZATION_CUSTOM_DOMAIN_MISSING');
  return value;
}
