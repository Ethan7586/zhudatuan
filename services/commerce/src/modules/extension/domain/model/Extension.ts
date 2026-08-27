import type { Manifest } from './Manifest';

export class Extension {
  constructor(readonly manifest: Manifest) {
    if (!/^[a-z][a-z0-9]{1,63}$/.test(manifest.value.id) || !/^\d+\.\d+\.\d+$/.test(manifest.value.version)) {
      throw new Error('EXTENSION_IDENTITY_INVALID');
    }
    Object.freeze(this);
  }
}
