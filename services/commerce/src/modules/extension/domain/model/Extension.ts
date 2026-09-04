import type { Manifest } from './Manifest';

export class Extension {
  constructor(readonly manifest: Manifest) {
    const value = manifest.value;
    if (
      !/^[a-z][a-z0-9]{1,63}$/.test(value.id) ||
      !/^\d+\.\d+\.\d+$/.test(value.version) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value.apiVersion) ||
      !value.contractVersion.startsWith(`${value.id}.v`) ||
      value.capabilities.length === 0 ||
      value.permissions.length === 0 ||
      !value.configSchema.trim()
    ) {
      throw new Error('EXTENSION_IDENTITY_INVALID');
    }
    Object.freeze(this);
  }
}
