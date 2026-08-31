export class ExternalMapping {
  constructor(
    readonly provider: string,
    readonly objectType: string,
    readonly externalId: string,
    readonly internalType: string,
    readonly internalId: string,
    readonly sourceVersion: string
  ) {
    if ([provider, objectType, externalId, internalType, internalId, sourceVersion].some((value) => !value.trim())) {
      throw new Error('CHANNEL_EXTERNAL_MAPPING_INVALID');
    }
  }

  get identity(): string {
    return `${this.provider}:${this.objectType}:${this.externalId}`;
  }
}
