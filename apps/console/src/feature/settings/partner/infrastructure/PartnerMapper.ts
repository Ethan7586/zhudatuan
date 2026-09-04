import { deepFreeze } from '../../../../shared/model/Immutable';
import type { Partner, PartnerPage } from '../model/Partner';
import type { PartnerReceipt, Store, StorePage } from '../model/Store';
import { PartnerDtoSchema, PartnerPageDtoSchema, StoreDtoSchema, StorePageDtoSchema, type PartnerDto, type StoreDto } from './PartnerSchema';

export class PartnerMapper {
  partners(value: unknown): PartnerPage {
    const page = PartnerPageDtoSchema.parse(value) as Readonly<{ items: readonly PartnerDto[]; count: number; nextCursor?: string }>;
    return deepFreeze({ items: page.items.map(partner), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  stores(value: unknown): StorePage {
    const page = StorePageDtoSchema.parse(value) as Readonly<{ items: readonly Required<StoreDto>[]; count: number; nextCursor?: string }>;
    return deepFreeze({ items: page.items.map(store), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  partnerReceipt(value: unknown): PartnerReceipt {
    const item = PartnerDtoSchema.parse(value) as PartnerDto;
    return Object.freeze({ id: item.id, kind: item.kind, version: item.version });
  }

  storeReceipt(value: unknown): PartnerReceipt {
    const item = StoreDtoSchema.parse(value) as StoreDto;
    return Object.freeze({ id: item.id, kind: 'store', version: item.version });
  }
}

function partner(item: PartnerDto): Partner {
  if (item.kind === 'store') throw new Error('PARTNER_KIND_INVALID');
  return {
    id: item.id,
    scopeId: item.scope_id,
    kind: item.kind,
    name: item.name,
    status: item.status,
    version: item.version,
    qualification: { valid: item.qualification.valid, pending: item.qualification.pending, rejected: item.qualification.rejected, expired: item.qualification.expired, nearestExpiry: item.qualification.nearest_expiry },
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

function store(item: Required<StoreDto>): Store {
  return {
    id: item.id,
    scopeId: item.scope,
    name: item.name,
    status: item.status,
    version: item.version,
    mallId: item.mall,
    regionCode: item.regionCode,
    serviceRadiusMeters: item.serviceRadiusMeters,
    addressConfigured: item.addressConfigured,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
