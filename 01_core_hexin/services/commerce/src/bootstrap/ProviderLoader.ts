import type { JsonObject,UnsignedProviderManifest } from '@shop/contract';
import type { ProviderInstallation } from '@shop/providercore';
import type { VendorConnection } from '@shop/vendorcore';
import type { ExtensionCandidate,ExtensionLoader,ExtensionLoadContext } from '../modules/extension';
import { Manifest } from '../modules/extension/02_domain_yewu/model/Manifest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import type { SecretStore } from '../foundation/infrastructure/SecretStore';
import type { ExtensionRegistry } from './ExtensionRegistry';
import { providerFactory } from './ProviderFactories';
import { createPrivateProviderInstallation } from '../modules/channel/ChannelModule';
import { PgUnitOfWork } from '../foundation/infrastructure/PgUnitOfWork';

interface InstallationRow { readonly id:string; readonly extension_id:string; readonly scope_id:string; readonly manifest:unknown;
  readonly base_url:string|null; readonly endpoints:unknown; readonly secret_ref:string|null; readonly health_operation:string|null; readonly version:number }

export class RuntimeExtensionLoader implements ExtensionLoader {
  constructor(private readonly pool:DatabasePool,private readonly secrets:SecretStore,private readonly registry:ExtensionRegistry) {}

  definition(provider:string):UnsignedProviderManifest { return providerFactory(provider).definition; }

  async load():Promise<void> {
    const result=await this.pool.query<InstallationRow>(`select id,extension_id,scope_id,manifest,base_url,endpoints,secret_ref,
      health_operation,version from extension.enabled_installations()`);
    for (const row of result.rows) await this.registry.register(row.id,row.scope_id,Number(row.version),await this.create(row));
  }

  async stage(installation:string,context:ExtensionLoadContext):Promise<ExtensionCandidate> {
    const row=await new PgUnitOfWork(this.pool).execute<InstallationRow|undefined>({ ...context },async(database)=>{
      const result=await database.query<InstallationRow>(`select id,extension_id,scope_id,manifest,base_url,endpoints,secret_ref,
        health_operation,version from extension.load_installation($1,$2)`,[installation,context.scope]); return result.rows[0];
    });
    if (!row) throw new Error('PROVIDER_INSTALLATION_NOT_RUNNABLE');
    return this.registry.stage(row.id,row.scope_id,Number(row.version),await this.create(row));
  }

  activate(candidate:ExtensionCandidate):Promise<void> { return this.registry.activate(candidate.token); }
  discard(candidate:ExtensionCandidate):Promise<void> { return this.registry.discard(candidate.token); }
  active(candidate:ExtensionCandidate):boolean { return this.registry.active(candidate.provider,candidate.scope,candidate.installation); }
  disable(provider:string,scope:string):Promise<void> { return this.registry.disable(provider,scope); }

  private async create(row:InstallationRow) {
    const manifest=Manifest.parse(row.manifest,row.extension_id).value; const factory=providerFactory(row.extension_id);
    if (factory.transport==='local') {
      const installation:ProviderInstallation={ manifest,local:createPrivateProviderInstallation(this.pool,row.scope_id) };
      return factory.create(installation);
    }
    const secret=parseSecret(await this.secrets.read(required(row.secret_ref,'PROVIDER_SECRET_REF_MISSING')));
    if (row.health_operation!==manifest.healthOperation) throw new Error('PROVIDER_HEALTH_OPERATION_MISMATCH');
    const connection:VendorConnection=Object.freeze({ id:row.id,baseUrl:required(row.base_url,'PROVIDER_BASE_URL_MISSING'),
      endpoints:stringMap(row.endpoints,'PROVIDER_ENDPOINTS_INVALID'),secret,limits:manifest.limits,healthOperation:manifest.healthOperation });
    return factory.create({ manifest,connection });
  }
}

export async function loadProviders(pool:DatabasePool,secrets:SecretStore,registry:ExtensionRegistry):Promise<RuntimeExtensionLoader> {
  const loader=new RuntimeExtensionLoader(pool,secrets,registry); await loader.load(); return loader;
}

function parseSecret(value:string):Readonly<Record<string,string>> {
  try { return stringMap(JSON.parse(value),'PROVIDER_SECRET_INVALID'); }
  catch(cause) { throw new Error('PROVIDER_SECRET_JSON_INVALID',{ cause }); }
}
function stringMap(value:unknown,code:string):Readonly<Record<string,string>> {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error(code);
  const entries=Object.entries(value as JsonObject); if (!entries.every(([,item])=>typeof item==='string' && item.trim())) throw new Error(code);
  return Object.freeze(Object.fromEntries(entries) as Record<string,string>);
}
function required(value:string|null,code:string):string { if (!value?.trim()) throw new Error(code); return value; }
