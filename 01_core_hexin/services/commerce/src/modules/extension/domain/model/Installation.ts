export type InstallationState='disabled'|'testing'|'enabled'|'degraded';

export class Installation {
  constructor(readonly id: string, readonly extension: string, readonly extensionVersion: string, readonly scope: string,
    readonly state: InstallationState, readonly version: number) {
    if (!id || !extension || !extensionVersion || !scope || !Number.isSafeInteger(version) || version<0) throw new Error('EXTENSION_INSTALLATION_INVALID');
    Object.freeze(this);
  }

  transition(next: InstallationState): Installation {
    const allowed: Readonly<Record<InstallationState,readonly InstallationState[]>>={
      disabled:['testing'], testing:['enabled','degraded','disabled'], enabled:['degraded','disabled'], degraded:['testing','enabled','disabled'],
    };
    if (!allowed[this.state].includes(next)) throw new Error(`EXTENSION_STATE_INVALID:${this.state}:${next}`);
    return new Installation(this.id,this.extension,this.extensionVersion,this.scope,next,this.version+1);
  }
}
