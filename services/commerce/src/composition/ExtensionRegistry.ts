import { PROVIDER_PORT_BY_CAPABILITY, type ChannelProvider, type ProviderCapability, type ProviderHealth, type ProviderHealthState, type ProviderPortForCapability } from '@shop/contract';
import { ProviderRoute } from './ProviderRoute';
import type { ManifestVerifier } from './SignatureVerifier';
import { assertInstalledProvider } from '@shop/providercore';
import { token } from './Container';
import { mapParallel } from '@shop/kernel';
import { safeErrorCode } from '../platform/error/SafeError';

interface Installation {
  readonly installation: string;
  readonly version: number;
  readonly scope: string;
  readonly extension: ChannelProvider;
  readonly route: ProviderRoute;
}

interface CandidateInstallation {
  readonly installation: string;
  readonly version: number;
  readonly scope: string;
  readonly extension: ChannelProvider;
  readonly expected: Readonly<{ installation: string; version: number }> | null;
}

export interface RegistryCandidate {
  readonly token: string;
  readonly installation: string;
  readonly provider: string;
  readonly scope: string;
  readonly version: number;
  readonly manifest: ChannelProvider['manifest'];
  readonly health: ProviderHealth;
  readonly latency: number;
  readonly probes: Readonly<{ contract: 'passed'; sandbox: ProviderHealth; canary: ProviderHealth }>;
}

export interface ExtensionHealth extends ProviderHealth {
  readonly provider: string;
  readonly scope: string;
}

export class ExtensionRegistry {
  private readonly extensions = new Map<string, Installation>();
  private readonly candidates = new Map<string, CandidateInstallation>();
  private frozen = false;

  constructor(private readonly verifier: ManifestVerifier) {}

  async register(installation: string, scope: string, version: number, extension: ChannelProvider): Promise<void> {
    const key = installationKey(extension.manifest.id, scope);
    if (this.extensions.has(key)) throw new Error('EXTENSION_DUPLICATE:' + key);
    if (!(await this.verifier.verify(extension.manifest))) throw new Error('EXTENSION_SIGNATURE_INVALID:' + extension.manifest.id);
    assertInstalledProvider(extension);
    await extension.start();
    const health = await extension.health();
    if (health.state !== 'healthy') {
      await stopBefore(extension, Date.now() + extension.manifest.timeout.totalMs);
      throw new Error('EXTENSION_STARTUP_UNHEALTHY:' + extension.manifest.id);
    }
    this.extensions.set(key, Object.freeze({ installation, version, scope, extension, route: new ProviderRoute(extension) }));
  }

  async stage(installation: string, scope: string, version: number, extension: ChannelProvider): Promise<RegistryCandidate> {
    if (!(await this.verifier.verify(extension.manifest))) throw new Error('EXTENSION_SIGNATURE_INVALID:' + extension.manifest.id);
    assertInstalledProvider(extension);
    await extension.start();
    const started = Date.now();
    const sandbox = await probe(extension, 'SANDBOX_PROBE_FAILED');
    const canary = sandbox.state === 'healthy' ? await probe(extension, 'CANARY_PROBE_FAILED') : sandbox;
    const health = canary;
    const key = installationKey(extension.manifest.id, scope);
    const active = this.extensions.get(key);
    const token = crypto.randomUUID();
    this.candidates.set(token, Object.freeze({ installation, version, scope, extension, expected: active ? Object.freeze({ installation: active.installation, version: active.version }) : null }));
    return Object.freeze({
      token,
      installation,
      provider: extension.manifest.id,
      scope,
      version,
      manifest: extension.manifest,
      health,
      latency: Math.max(0, Date.now() - started),
      probes: Object.freeze({ contract: 'passed', sandbox, canary }),
    });
  }

  async activate(token: string): Promise<void> {
    const candidate = this.candidates.get(token);
    if (!candidate) throw new Error('EXTENSION_CANDIDATE_MISSING');
    const key = installationKey(candidate.extension.manifest.id, candidate.scope);
    const previous = this.extensions.get(key);
    if (candidate.expected === null ? previous !== undefined : previous?.installation !== candidate.expected.installation || previous.version !== candidate.expected.version) {
      throw new Error('EXTENSION_REGISTRY_CAS_FAILED');
    }
    const replacement = Object.freeze({ installation: candidate.installation, version: candidate.version, scope: candidate.scope, extension: candidate.extension, route: new ProviderRoute(candidate.extension) });
    this.extensions.set(key, replacement);
    this.candidates.delete(token);
    if (previous) {
      previous.route.close();
      await previous.route.drain(Date.now() + previous.extension.manifest.timeout.totalMs);
      await stopBefore(previous.extension, Date.now() + previous.extension.manifest.timeout.totalMs);
    }
  }

  async discard(token: string): Promise<void> {
    const candidate = this.candidates.get(token);
    if (!candidate) return;
    this.candidates.delete(token);
    await stopBefore(candidate.extension, Date.now() + candidate.extension.manifest.timeout.totalMs);
  }

  async disable(provider: string, scope: string, deadline = Date.now() + 30_000): Promise<Readonly<{ drained: boolean; stopped: boolean; active: number; waited: number }>> {
    const started = Date.now();
    const key = installationKey(provider, scope);
    const current = this.extensions.get(key);
    this.extensions.delete(key);
    const staged = [...this.candidates.entries()].filter(([, item]) => installationKey(item.extension.manifest.id, item.scope) === key);
    staged.forEach(([token]) => this.candidates.delete(token));
    current?.route.close();
    const drained = current ? await current.route.drain(deadline) : true;
    const stops = await mapParallel([current?.extension, ...staged.map(([, item]) => item.extension)].filter(Boolean), 8, (item) => stopBefore(item!, deadline));
    return Object.freeze({ drained, stopped: stops.every(Boolean), active: current?.route.active ?? 0, waited: Math.max(0, Date.now() - started) });
  }

  active(provider: string, scope: string, installation: string): boolean {
    const current = this.extensions.get(installationKey(provider, scope));
    return current?.installation === installation;
  }

  freeze(): void {
    this.frozen = true;
  }

  strategy<C extends ProviderCapability>(providerId: string, scope: string, capability: C | readonly C[]): ProviderPortForCapability<C> {
    if (!this.frozen) throw new Error('EXTENSION_REGISTRY_NOT_FROZEN');
    const installation = this.extensions.get(installationKey(providerId, scope));
    if (!installation) throw new Error('EXTENSION_MISSING:' + providerId);
    const requested: readonly C[] = typeof capability === 'string' ? [capability] : capability;
    if (requested.length === 0 || new Set(requested).size !== requested.length) throw new Error('EXTENSION_STRATEGY_CAPABILITY_INVALID');
    const ports = new Set(requested.map((item) => PROVIDER_PORT_BY_CAPABILITY[item]));
    if (ports.size !== 1) throw new Error('EXTENSION_STRATEGY_PORT_AMBIGUOUS');
    const selected = requested.find((item) => installation.extension.manifest.capabilities.includes(item));
    if (!selected) throw new Error('EXTENSION_CAPABILITY_MISSING:' + providerId + ':' + requested.join(','));
    return installation.route.strategy(PROVIDER_PORT_BY_CAPABILITY[selected]) as ProviderPortForCapability<C>;
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

  registrations(): readonly Readonly<{ installation: string; provider: string; scope: string }>[] {
    return Object.freeze([...this.extensions.values()].map(({ installation, scope, extension }) => Object.freeze({ installation, provider: extension.manifest.id, scope })));
  }

  async healthAll(): Promise<readonly ExtensionHealth[]> {
    if (!this.frozen) throw new Error('EXTENSION_REGISTRY_NOT_FROZEN');
    return Object.freeze(
      await mapParallel([...this.extensions.values()], 8, async ({ scope, extension }) => {
        try {
          return Object.freeze({ provider: extension.manifest.id, scope, ...(await extension.health()) });
        } catch (cause) {
          return Object.freeze({
            provider: extension.manifest.id,
            scope,
            state: 'unavailable' as ProviderHealthState,
            checkedAt: new Date().toISOString(),
            reason: safeErrorCode(cause, 'EXTENSION_HEALTH_FAILED'),
          });
        }
      })
    );
  }

  async stop(): Promise<void> {
    for (const installation of this.extensions.values()) installation.route.close();
    await mapParallel([...this.extensions.values()], 8, ({ route, extension }) => route.drain(Date.now() + extension.manifest.timeout.totalMs));
    await mapParallel([...this.extensions.values(), ...this.candidates.values()], 8, ({ extension }) => stopBefore(extension, Date.now() + extension.manifest.timeout.totalMs));
    this.extensions.clear();
    this.candidates.clear();
  }
}

async function stopBefore(provider: ChannelProvider, deadline: number): Promise<boolean> {
  const stop = Promise.resolve()
    .then(() => provider.stop())
    .then(
      () => true,
      () => false
    );
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), Math.max(1, deadline - Date.now()));
    timer.unref?.();
  });
  const stopped = await Promise.race([stop, timeout]);
  clearTimeout(timer!);
  return stopped;
}

async function probe(extension: ChannelProvider, code: string): Promise<ProviderHealth> {
  try {
    return await extension.health();
  } catch (cause) {
    return { state: 'unavailable', checkedAt: new Date().toISOString(), reason: safeErrorCode(cause, code) };
  }
}

export const EXTENSION_REGISTRY = token<ExtensionRegistry>('extension.registry');

function installationKey(provider: string, scope: string): string {
  if (!provider.trim() || !scope.trim()) throw new Error('EXTENSION_INSTALLATION_KEY_INVALID');
  return provider + ':' + scope;
}
