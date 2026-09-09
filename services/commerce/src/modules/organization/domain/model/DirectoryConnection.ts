import { isOrganizationReference } from '@shop/kernel';

export type DirectoryConnectionStatus = 'draft' | 'enabled' | 'paused' | 'disabled' | 'revoked';

export interface DirectoryConnectionValue {
  readonly id: string;
  readonly tenantid: string;
  readonly organizationid: string;
  readonly providerid: string;
  readonly providertype: 'wecomcorp' | 'wecomsuite';
  readonly secretref: string;
  readonly cursor: string | null;
  readonly successfulversion: number;
  readonly status: DirectoryConnectionStatus;
  readonly version: number;
}

export class DirectoryConnection implements DirectoryConnectionValue {
  readonly id: string;
  readonly tenantid: string;
  readonly organizationid: string;
  readonly providerid: string;
  readonly providertype: 'wecomcorp' | 'wecomsuite';
  readonly secretref: string;
  readonly cursor: string | null;
  readonly successfulversion: number;
  readonly status: DirectoryConnectionStatus;
  readonly version: number;
  constructor(value: DirectoryConnectionValue) {
    if (
      !uuid(value.id) ||
      !isOrganizationReference(value.tenantid) ||
      !uuid(value.providerid) ||
      !/^[a-z][a-z0-9:.-]{2,127}$/.test(value.organizationid) ||
      !['wecomcorp', 'wecomsuite'].includes(value.providertype) ||
      !/^[a-z][a-z0-9./]{2,127}$/.test(value.secretref) ||
      !Number.isSafeInteger(value.successfulversion) ||
      value.successfulversion < 0 ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0
    )
      invalid();
    if (!['draft', 'enabled', 'paused', 'disabled', 'revoked'].includes(value.status)) invalid();
    if (value.cursor !== null && (value.cursor.length < 16 || value.cursor.length > 8192)) invalid();
    this.id = value.id;
    this.tenantid = value.tenantid;
    this.organizationid = value.organizationid;
    this.providerid = value.providerid;
    this.providertype = value.providertype;
    this.secretref = value.secretref;
    this.cursor = value.cursor;
    this.successfulversion = value.successfulversion;
    this.status = value.status;
    this.version = value.version;
    Object.freeze(this);
  }
  synchronizable(): boolean {
    return this.status === 'enabled';
  }
}
function uuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function invalid(): never {
  throw new Error('DIRECTORY_CONFIGURATION_INVALID');
}
