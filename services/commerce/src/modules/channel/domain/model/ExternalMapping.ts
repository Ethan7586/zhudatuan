export interface ExternalMappingSnapshot {
  readonly provider: string;
  readonly scope: string;
  readonly objectType: string;
  readonly externalId: string;
  readonly internalType: string;
  readonly internalId: string;
  readonly sourceVersion: string;
  readonly watermark: string;
  readonly version: number;
}

export class ExternalMapping {
  readonly provider: string;
  readonly scope: string;
  readonly objectType: string;
  readonly externalId: string;
  readonly internalType: string;
  readonly internalId: string;
  readonly sourceVersion: string;
  readonly watermark: string;
  readonly version: number;

  constructor(value: ExternalMappingSnapshot) {
    if ([value.provider, value.scope, value.objectType, value.externalId, value.internalType, value.internalId, value.sourceVersion].some((item) => !item.trim()) ||
      Number.isNaN(Date.parse(value.watermark)) || !Number.isSafeInteger(value.version) || value.version < 0) {
      throw new Error('CHANNEL_EXTERNAL_MAPPING_INVALID');
    }
    this.provider = value.provider;
    this.scope = value.scope;
    this.objectType = value.objectType;
    this.externalId = value.externalId;
    this.internalType = value.internalType;
    this.internalId = value.internalId;
    this.sourceVersion = value.sourceVersion;
    this.watermark = value.watermark;
    this.version = value.version;
    Object.freeze(this);
  }

  get identity(): string {
    return `${this.provider}:${this.scope}:${this.objectType}:${this.externalId}`;
  }
}
