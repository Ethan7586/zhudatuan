import { DomainError } from '../../../../platform/error/DomainError';

export type OrganizationKind = 'platform' | 'distributor' | 'tenant' | 'enterprise' | 'mall' | 'department';
export type OrganizationStatus = 'draft' | 'active' | 'disabled';

export interface OrganizationValue {
  readonly id: string;
  readonly kind: OrganizationKind;
  readonly parentid: string | null;
  readonly name: string;
  readonly timezone: string;
  readonly status: OrganizationStatus;
  readonly malllimit: number;
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;
}

export class Organization implements OrganizationValue {
  readonly id: string;
  readonly kind: OrganizationKind;
  readonly parentid: string | null;
  readonly name: string;
  readonly timezone: string;
  readonly status: OrganizationStatus;
  readonly malllimit: number;
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;

  constructor(value: OrganizationValue) {
    if (!value.id || !['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department'].includes(value.kind)) invalid('kind');
    if ((value.parentid === null) !== (value.kind === 'platform')) invalid('parentId');
    if (value.name.trim().length < 2 || value.name.trim().length > 120) invalid('name');
    assertTimezone(value.timezone);
    if (!['draft', 'active', 'disabled'].includes(value.status)) invalid('status');
    if (!Number.isSafeInteger(value.malllimit) || value.malllimit < 0 || value.malllimit > 10_000) invalid('mallLimit');
    if (!Number.isSafeInteger(value.version) || value.version < 0) invalid('version');
    assertTime(value.createdat, 'createdAt');
    assertTime(value.updatedat, 'updatedAt');
    if (Date.parse(value.updatedat) < Date.parse(value.createdat)) invalid('updatedAt');
    this.id = value.id;
    this.kind = value.kind;
    this.parentid = value.parentid;
    this.name = value.name.trim();
    this.timezone = value.timezone;
    this.status = value.status;
    this.malllimit = value.malllimit;
    this.version = value.version;
    this.createdat = value.createdat;
    this.updatedat = value.updatedat;
    Object.freeze(this);
  }

  allocateMall(input: Readonly<{ id: string; name: string; timezone: string; now: string }>): Organization {
    if (this.status !== 'active') throw new DomainError('VALIDATION_FAILED', { field: 'parentId' });
    return new Organization({ id: input.id, kind: 'mall', parentid: this.id, name: input.name, timezone: input.timezone, status: 'draft', malllimit: 0, version: 1, createdat: input.now, updatedat: input.now });
  }

  revised(input: Readonly<{ name: string; timezone: string; status: OrganizationStatus; now: string }>): Organization {
    if (this.kind !== 'mall') throw new DomainError('VALIDATION_FAILED', { field: 'mallId' });
    return new Organization({ ...this, name: input.name, timezone: input.timezone, status: input.status, version: this.version + 1, updatedat: input.now });
  }
}

function assertTimezone(value: string): void {
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone: value }).format(new Date(0));
  } catch {
    invalid('timezone');
  }
}

function assertTime(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) invalid(field);
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
