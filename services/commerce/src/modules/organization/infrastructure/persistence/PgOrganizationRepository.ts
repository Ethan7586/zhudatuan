import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { OrganizationRepository } from '../../application/port/OrganizationRepository';
import { PgDirectoryInbox } from './PgDirectoryInbox';
import { PgDirectoryRepository } from './PgDirectoryRepository';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { databaseInteger } from '../../../../foundation/persistence/DatabaseInteger';
import { mapMall, mapOrganization, mallColumns, type MallRow, type OrganizationRow } from './MallRecord';
export class PgOrganizationRepository implements OrganizationRepository {
  private readonly directoryStore = new PgDirectoryRepository();
  private readonly inbox = new PgDirectoryInbox();
  constructor(private readonly transactions: PgTransactionAccess) {}
  async layers(context: ReadTransactionContext, input: Parameters<OrganizationRepository['layers']>[1]) {
    const result = await this.transactions.database(context).query(
      `select child.id,child.kind,child.parent_id,parent.name parent_name,child.name,child.timezone,child.status,child.version
        from organization.unitclosure visible
        join organization.organization child on child.id=visible.descendant_id
        left join organization.organization parent on parent.id=child.parent_id
        where visible.ancestor_id=$1 and ($2::text is null or child.id>$2)
        order by child.id limit $3`,
      [input.scope, input.after, input.fetch]
    );
    return result.rows;
  }
  directories(context: ReadTransactionContext, scope: string, after: string | null, fetch: number) {
    return this.directoryStore.list(context, scope, after, fetch);
  }
  directory(context: ReadTransactionContext, id: string) {
    return this.directoryStore.require(context, id);
  }
  lockDirectory(context: WriteTransactionContext, id: string) {
    return this.directoryStore.lock(context, id);
  }
  webhookDirectory(context: ReadTransactionContext, id: string) {
    return this.directoryStore.requireWebhook(context, id);
  }
  saveDirectory(context: WriteTransactionContext, value: Parameters<OrganizationRepository['saveDirectory']>[1], expectedVersion: number) {
    return this.directoryStore.save(context, value, expectedVersion);
  }
  runs(context: ReadTransactionContext, connection: string, after: string | null, fetch: number) {
    return this.directoryStore.runs(context, connection, after, fetch);
  }
  createRun(context: WriteTransactionContext, connection: string, mode: Parameters<OrganizationRepository['createRun']>[2], key: string, preview = false) {
    return this.directoryStore.createRun(context, connection, mode, key, preview);
  }
  resumeRun(context: WriteTransactionContext, connection: string, run: string, key: string) {
    return this.directoryStore.resumeRun(context, connection, run, key);
  }
  cancelRun(context: WriteTransactionContext, connection: string, run: string) {
    return this.directoryStore.cancelRun(context, connection, run);
  }
  receive(context: WriteTransactionContext, input: Parameters<OrganizationRepository['receive']>[1]) {
    return this.inbox.receive(context, input);
  }

  async lockMallParent(context: WriteTransactionContext, parent: string, accessScope: string) {
    const result = await this.transactions.database(context).query<OrganizationRow & { readonly visible: boolean; readonly active_malls: unknown }>(
      `select organization.id,organization.kind,organization.parent_id,organization.name,organization.timezone,organization.status,
        organization.mall_limit,organization.version,organization.created_at,organization.updated_at,
        exists(select 1 from organization.unitclosure visible where visible.ancestor_id=$2 and visible.descendant_id=organization.id) visible,
        (select count(*) from organization.organization child where child.parent_id=organization.id and child.kind='mall' and child.status<>'disabled') active_malls
       from organization.organization organization where organization.id=$1 for update of organization`,
      [parent, accessScope]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return Object.freeze({ organization: mapOrganization(row), visible: row.visible, activeMalls: databaseInteger(row.active_malls) });
  }

  mall(context: ReadTransactionContext, mall: string, accessScope: string) {
    return this.requireMall(context, mall, accessScope);
  }

  async lockMall(context: WriteTransactionContext, mall: string, accessScope: string) {
    const database = this.transactions.database(context);
    const locked = await database.query(
      `select organization.id from organization.organization organization
       join organization.mall mall on mall.id=organization.id
       join organization.unitclosure visible on visible.ancestor_id=$2 and visible.descendant_id=organization.id
       where organization.id=$1 and organization.kind='mall' for update of organization,mall`,
      [mall, accessScope]
    );
    if (locked.rowCount !== 1) throw new DomainError('RESOURCE_NOT_FOUND');
    return this.requireMall(context, mall, accessScope);
  }

  async membershipWithin(context: ReadTransactionContext, membership: string, organization: string) {
    const result = await this.transactions.database(context).query<{ readonly allowed: boolean }>(
      `select exists(
        select 1 from organization.membership membership
        join organization.unitclosure closure on closure.ancestor_id=membership.organization_id and closure.descendant_id=$2
        where membership.source_membership_id=$1 and membership.status='active'
      ) allowed`,
      [membership, organization]
    );
    return result.rows[0]?.allowed === true;
  }

  async createMall(context: WriteTransactionContext, input: Parameters<OrganizationRepository['createMall']>[1]) {
    const database = this.transactions.database(context);
    const parent = await database.query(
      `update organization.organization set version=version+1,updated_at=clock_timestamp()
       where id=$1 and version=$2 and status='active' returning id`,
      [input.parent.id, input.expectedParentVersion]
    );
    if (parent.rowCount !== 1) throw new DomainError('VERSION_CONFLICT');
    const organization = input.mall.organization;
    try {
      await database.query(
        `insert into organization.organization(id,kind,parent_id,name,timezone,status,mall_limit,version,created_at,updated_at)
         values($1,'mall',$2,$3,$4,$5,0,$6,$7,$7)`,
        [organization.id, organization.parentid, organization.name, organization.timezone, organization.status, organization.version, organization.createdat]
      );
      await database.query(
        `insert into organization.unitclosure(ancestor_id,descendant_id,depth)
         select ancestor_id,$1,depth+1 from organization.unitclosure where descendant_id=$2
         union all select $1,$1,0`,
        [organization.id, organization.parentid]
      );
      await database.query(
        `insert into organization.mall(id,code,public_slug,brand_name,domain_mode,custom_domain,owner_membership_id,currency,
          theme_preset,theme_primary_color,theme_accent_color,theme_logo_object_ref,theme_favicon_object_ref,
          opening_state,subject_type,company_name,credit_code,legal_representative,contact_name,contact_mobile,license_object_ref,
          store_type,primary_category,business_mode,business_region,business_address,service_phone,certificate_mode,certificate_object_ref,
          mini_program_mode,mini_program_app_id,mini_program_original_id,official_account_mode,official_account_app_id,video_channel_id,
          payment_plan,wechat_merchant_id,delivery_mode,warehouse_region,return_contact,return_address,invoice_mode,notification_contact,
          version,created_at,updated_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$45)`,
        [
          organization.id,
          input.mall.code,
          input.mall.publicSlug,
          input.mall.brandName,
          input.mall.domain.mode,
          input.mall.domain.mode === 'custom' ? input.mall.domain.customDomain : null,
          input.mall.ownerMembershipId,
          input.mall.currency,
          input.mall.theme.preset,
          input.mall.theme.primaryColor,
          input.mall.theme.accentColor,
          input.mall.theme.logoObjectRef,
          input.mall.theme.faviconObjectRef,
          input.mall.opening.state,
          input.mall.opening.subject.type,
          input.mall.opening.subject.companyName,
          input.mall.opening.subject.creditCode,
          input.mall.opening.subject.legalRepresentative,
          input.mall.opening.subject.contactName,
          input.mall.opening.subject.contactMobile,
          input.mall.opening.subject.licenseObjectRef,
          input.mall.opening.business.storeType,
          input.mall.opening.business.primaryCategory,
          input.mall.opening.business.mode,
          input.mall.opening.business.region,
          input.mall.opening.business.address,
          input.mall.opening.business.servicePhone,
          input.mall.opening.certificateMode,
          input.mall.opening.certificateObjectRef,
          input.mall.opening.channels.miniProgramMode,
          input.mall.opening.channels.miniProgramAppId,
          input.mall.opening.channels.miniProgramOriginalId,
          input.mall.opening.channels.officialAccountMode,
          input.mall.opening.channels.officialAccountAppId,
          input.mall.opening.channels.videoChannelId,
          input.mall.opening.payment.plan,
          input.mall.opening.payment.wechatMerchantId,
          input.mall.opening.fulfillment.deliveryMode,
          input.mall.opening.fulfillment.warehouseRegion,
          input.mall.opening.fulfillment.returnContact,
          input.mall.opening.fulfillment.returnAddress,
          input.mall.opening.invoiceMode,
          input.mall.opening.notificationContact,
          input.mall.version,
          input.mall.createdat,
        ]
      );
      await this.saveOwner(context, input.owner);
      return input.mall;
    } catch (cause) {
      throw mallPersistenceError(cause);
    }
  }

  async updateMall(context: WriteTransactionContext, input: Parameters<OrganizationRepository['updateMall']>[1]) {
    const database = this.transactions.database(context);
    const organization = input.mall.organization;
    const updatedOrganization = await database.query(
      `update organization.organization set name=$2,timezone=$3,status=$4,version=$5,updated_at=$6
       where id=$1 and version=$7 and kind='mall' returning id`,
      [organization.id, organization.name, organization.timezone, organization.status, organization.version, organization.updatedat, input.current.organization.version]
    );
    if (updatedOrganization.rowCount !== 1) throw new DomainError('VERSION_CONFLICT');
    try {
      const updatedMall = await database.query(
        `update organization.mall set code=$2,public_slug=$3,brand_name=$4,domain_mode=$5,custom_domain=$6,owner_membership_id=$7,
          currency=$8,theme_preset=$9,theme_primary_color=$10,theme_accent_color=$11,theme_logo_object_ref=$12,theme_favicon_object_ref=$13,
          opening_state=$14,subject_type=$15,company_name=$16,credit_code=$17,legal_representative=$18,contact_name=$19,contact_mobile=$20,
          license_object_ref=$21,store_type=$22,primary_category=$23,business_mode=$24,business_region=$25,business_address=$26,service_phone=$27,
          certificate_mode=$28,certificate_object_ref=$29,mini_program_mode=$30,mini_program_app_id=$31,mini_program_original_id=$32,
          official_account_mode=$33,official_account_app_id=$34,video_channel_id=$35,payment_plan=$36,wechat_merchant_id=$37,
          delivery_mode=$38,warehouse_region=$39,return_contact=$40,return_address=$41,invoice_mode=$42,notification_contact=$43,
          version=$44,updated_at=$45 where id=$1 and version=$46 returning id`,
        [
          organization.id,
          input.mall.code,
          input.mall.publicSlug,
          input.mall.brandName,
          input.mall.domain.mode,
          input.mall.domain.mode === 'custom' ? input.mall.domain.customDomain : null,
          input.mall.ownerMembershipId,
          input.mall.currency,
          input.mall.theme.preset,
          input.mall.theme.primaryColor,
          input.mall.theme.accentColor,
          input.mall.theme.logoObjectRef,
          input.mall.theme.faviconObjectRef,
          input.mall.opening.state,
          input.mall.opening.subject.type,
          input.mall.opening.subject.companyName,
          input.mall.opening.subject.creditCode,
          input.mall.opening.subject.legalRepresentative,
          input.mall.opening.subject.contactName,
          input.mall.opening.subject.contactMobile,
          input.mall.opening.subject.licenseObjectRef,
          input.mall.opening.business.storeType,
          input.mall.opening.business.primaryCategory,
          input.mall.opening.business.mode,
          input.mall.opening.business.region,
          input.mall.opening.business.address,
          input.mall.opening.business.servicePhone,
          input.mall.opening.certificateMode,
          input.mall.opening.certificateObjectRef,
          input.mall.opening.channels.miniProgramMode,
          input.mall.opening.channels.miniProgramAppId,
          input.mall.opening.channels.miniProgramOriginalId,
          input.mall.opening.channels.officialAccountMode,
          input.mall.opening.channels.officialAccountAppId,
          input.mall.opening.channels.videoChannelId,
          input.mall.opening.payment.plan,
          input.mall.opening.payment.wechatMerchantId,
          input.mall.opening.fulfillment.deliveryMode,
          input.mall.opening.fulfillment.warehouseRegion,
          input.mall.opening.fulfillment.returnContact,
          input.mall.opening.fulfillment.returnAddress,
          input.mall.opening.invoiceMode,
          input.mall.opening.notificationContact,
          input.mall.version,
          input.mall.updatedat,
          input.expectedVersion,
        ]
      );
      if (updatedMall.rowCount !== 1) throw new DomainError('VERSION_CONFLICT');
      if (input.owner) {
        await database.query(
          `update organization.membership set status='inactive',version=version+1,updated_at=$2
           where organization_id=$1 and responsibility='owner' and status='active' and source_membership_id<>$3`,
          [organization.id, input.mall.updatedat, input.owner.sourcemembershipid]
        );
        await this.saveOwner(context, input.owner);
      }
      return input.mall;
    } catch (cause) {
      throw mallPersistenceError(cause);
    }
  }

  private async requireMall(context: ReadTransactionContext, mall: string, accessScope: string) {
    const result = await this.transactions.database(context).query<MallRow>(
      `select ${mallColumns} from organization.organization organization
       join organization.mall mall on mall.id=organization.id
       join organization.unitclosure visible on visible.ancestor_id=$2 and visible.descendant_id=organization.id
       where organization.id=$1 and organization.kind='mall'`,
      [mall, accessScope]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    return mapMall(row);
  }

  private async saveOwner(context: WriteTransactionContext, owner: Parameters<OrganizationRepository['createMall']>[1]['owner']) {
    await this.transactions.database(context).query(
      `insert into organization.membership(id,organization_id,source_membership_id,responsibility,status,version,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict(organization_id,source_membership_id,responsibility) do update set status='active',version=organization.membership.version+1,updated_at=excluded.updated_at`,
      [owner.id, owner.organizationid, owner.sourcemembershipid, owner.responsibility, owner.status, owner.version, owner.createdat, owner.updatedat]
    );
  }
}

function mallPersistenceError(cause: unknown): unknown {
  if (cause instanceof DomainError) return cause;
  const constraint = cause !== null && typeof cause === 'object' && Reflect.get(cause, 'code') === '23505' ? String(Reflect.get(cause, 'constraint') ?? '') : '';
  if (constraint === 'organization_mall_code_unique') return new DomainError('VALIDATION_FAILED', { field: 'code' });
  if (constraint === 'organization_mall_slug_unique') return new DomainError('VALIDATION_FAILED', { field: 'publicSlug' });
  if (constraint === 'organization_mall_domain_unique') return new DomainError('VALIDATION_FAILED', { field: 'customDomain' });
  return cause;
}
