export type InstallationState = 'disabled' | 'testing' | 'enabled' | 'degraded';

export class Installation {
  constructor(
    readonly id: string,
    readonly extension: string,
    readonly extensionVersion: string,
    readonly scope: string,
    readonly state: InstallationState,
    readonly configurationVersion: number,
    readonly version: number
  ) {
    if (
      !id ||
      !/^[a-z][a-z0-9]{1,63}$/.test(extension) ||
      !/^\d+\.\d+\.\d+$/.test(extensionVersion) ||
      !scope ||
      !['disabled', 'testing', 'enabled', 'degraded'].includes(state) ||
      !Number.isSafeInteger(configurationVersion) ||
      configurationVersion < 0 ||
      !Number.isSafeInteger(version) ||
      version < 0
    ) {
      throw new Error('EXTENSION_INSTALLATION_INVALID');
    }
    Object.freeze(this);
  }

  transition(next: InstallationState): Installation {
    const allowed: Readonly<Record<InstallationState, readonly InstallationState[]>> = {
      disabled: ['testing'],
      testing: ['enabled', 'degraded', 'disabled'],
      enabled: ['degraded', 'disabled'],
      degraded: ['testing', 'enabled', 'disabled'],
    };
    if (!allowed[this.state].includes(next)) throw new Error(`EXTENSION_STATE_INVALID:${this.state}:${next}`);
    return new Installation(this.id, this.extension, this.extensionVersion, this.scope, next, this.configurationVersion, this.version + 1);
  }

  reconfigure(expectedConfigurationVersion: number): Installation {
    if (this.state !== 'disabled') throw new Error('EXTENSION_RECONFIGURE_STATE_INVALID');
    if (this.configurationVersion !== expectedConfigurationVersion) throw new Error('EXTENSION_CONFIGURATION_VERSION_CONFLICT');
    return new Installation(this.id, this.extension, this.extensionVersion, this.scope, this.state, this.configurationVersion + 1, this.version + 1);
  }
}
