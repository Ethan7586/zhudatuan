import type { ChannelProvider, ProviderCapability, ProviderHealth, ProviderHealthState, ProviderPortName, ProviderPorts } from '@shop/contract';
import type { ManifestVerifier } from './SignatureVerifier';

interface Installation {
  readonly installation:string;
  readonly version:number;
  readonly scope: string;
  readonly extension: ChannelProvider;
}

export interface RegistryCandidate { readonly token:string; readonly installation:string; readonly provider:string; readonly scope:string;
  readonly version:number; readonly manifest:ChannelProvider['manifest']; readonly health:ProviderHealth; readonly latency:number }

export interface ExtensionHealth extends ProviderHealth {
  readonly provider: string;
  readonly scope: string;
}

export class ExtensionRegistry {
  private readonly extensions = new Map<string, Installation>();
  private readonly candidates = new Map<string, Installation>();
  private frozen = false;

  constructor(private readonly verifier: ManifestVerifier) {}

  async register(installation:string,scope:string,version:number,extension:ChannelProvider):Promise<void> {
    const key = installationKey(extension.manifest.id, scope);
    if (this.extensions.has(key)) throw new Error('EXTENSION_DUPLICATE:' + key);
    if (!await this.verifier.verify(extension.manifest)) throw new Error('EXTENSION_SIGNATURE_INVALID:' + extension.manifest.id);
    await extension.start();
    const health=await extension.health();
    if (health.state!=='healthy') { await extension.stop(); throw new Error('EXTENSION_STARTUP_UNHEALTHY:' + extension.manifest.id); }
    this.extensions.set(key, Object.freeze({ installation,version,scope,extension }));
  }

  async stage(installation:string,scope:string,version:number,extension:ChannelProvider):Promise<RegistryCandidate> {
    if (!await this.verifier.verify(extension.manifest)) throw new Error('EXTENSION_SIGNATURE_INVALID:' + extension.manifest.id);
    await extension.start(); const started=Date.now();
    let health:ProviderHealth;
    try { health=await extension.health(); }
    catch(cause) { health={ state:'unavailable',checkedAt:new Date().toISOString(),reason:cause instanceof Error?cause.message:'EXTENSION_HEALTH_FAILED' }; }
    const token=crypto.randomUUID(); this.candidates.set(token,Object.freeze({ installation,version,scope,extension }));
    return Object.freeze({ token,installation,provider:extension.manifest.id,scope,version,manifest:extension.manifest,
      health,latency:Math.max(0,Date.now()-started) });
  }

  async activate(token:string):Promise<void> {
    const candidate=this.candidates.get(token); if (!candidate) throw new Error('EXTENSION_CANDIDATE_MISSING');
    const key=installationKey(candidate.extension.manifest.id,candidate.scope); const previous=this.extensions.get(key);
    this.extensions.set(key,candidate); this.candidates.delete(token);
    await previous?.extension.stop().catch(()=>undefined);
  }

  async discard(token:string):Promise<void> {
    const candidate=this.candidates.get(token); if (!candidate) return;
    this.candidates.delete(token); await candidate.extension.stop();
  }

  async disable(provider:string,scope:string):Promise<void> {
    const key=installationKey(provider,scope); const current=this.extensions.get(key); this.extensions.delete(key);
    const staged=[...this.candidates.entries()].filter(([,item])=>installationKey(item.extension.manifest.id,item.scope)===key);
    staged.forEach(([token])=>this.candidates.delete(token));
    await Promise.all([current?.extension,...staged.map(([,item])=>item.extension)].filter(Boolean).map((item)=>item!.stop()));
  }

  active(provider:string,scope:string,installation:string):boolean {
    const current=this.extensions.get(installationKey(provider,scope));
    return current?.installation===installation;
  }

  freeze(): void {
    this.frozen = true;
  }

  require<K extends ProviderPortName>(providerId: string, scope: string, capability: ProviderCapability, port: K): ProviderPorts[K] {
    if (!this.frozen) throw new Error('EXTENSION_REGISTRY_NOT_FROZEN');
    const installation = this.extensions.get(installationKey(providerId, scope));
    if (!installation) throw new Error('EXTENSION_MISSING:' + providerId);
    if (!installation.extension.manifest.capabilities.includes(capability)) {
      throw new Error('EXTENSION_CAPABILITY_MISSING:' + providerId + ':' + capability);
    }
    return installation.extension.require(port);
  }

  async health(providerId: string, scope: string): Promise<ProviderHealth> {
    if (!this.frozen) throw new Error('EXTENSION_REGISTRY_NOT_FROZEN');
    const installation = this.extensions.get(installationKey(providerId, scope));
    if (!installation) throw new Error('EXTENSION_MISSING:' + providerId);
    return installation.extension.health();
  }

  has(providerId: string, scope: string): boolean {
    return this.extensions.has(installationKey(providerId, scope));
  }

  all(): readonly ChannelProvider[] {
    return Object.freeze([...this.extensions.values()].map(({ extension }) => extension));
  }

  async healthAll(): Promise<readonly ExtensionHealth[]> {
    if (!this.frozen) throw new Error('EXTENSION_REGISTRY_NOT_FROZEN');
    return Object.freeze(await Promise.all([...this.extensions.values()].map(async ({ scope, extension }) => {
      try {
        return Object.freeze({ provider: extension.manifest.id, scope, ...await extension.health() });
      } catch (cause) {
        return Object.freeze({
          provider: extension.manifest.id,
          scope,
          state: 'unavailable' as ProviderHealthState,
          checkedAt: new Date().toISOString(),
          reason: cause instanceof Error ? cause.message : 'EXTENSION_HEALTH_FAILED',
        });
      }
    })));
  }

  async stop(): Promise<void> {
    await Promise.all([...this.extensions.values(),...this.candidates.values()].map(({ extension }) => extension.stop()));
    this.extensions.clear(); this.candidates.clear();
  }
}

function installationKey(provider: string, scope: string): string {
  if (!provider.trim() || !scope.trim()) throw new Error('EXTENSION_INSTALLATION_KEY_INVALID');
  return provider + ':' + scope;
}
