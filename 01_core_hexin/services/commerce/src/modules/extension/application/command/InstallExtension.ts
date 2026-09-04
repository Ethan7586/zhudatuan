import type { ProviderManifest } from '@shop/contract';
import type { ManifestVerifier } from '../../../../bootstrap/SignatureVerifier';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { Extension } from '../../domain/model/Extension';
import { Manifest } from '../../domain/model/Manifest';
import type { Installation } from '../../domain/model/Installation';
import type { ContractPolicy } from '../../domain/policy/ContractPolicy';
import type { ExtensionLoader, ExtensionRepositoryFactory } from '../port/ExtensionLoader';

export interface ExtensionInstallRequest {
  readonly id:string; readonly provider:string; readonly scope:string; readonly baseUrl:string|null;
  readonly endpoints:Readonly<Record<string,string>>; readonly secretRef:string|null; readonly secretKeys:readonly string[];
  readonly healthOperation:string; readonly actor:string; readonly trace:string;
}

export interface InstalledExtension { readonly installation:Installation; readonly manifest:ProviderManifest }
export interface ExtensionConfiguration { readonly baseUrl:string|null; readonly endpoints:Readonly<Record<string,string>>;
  readonly secretRef:string|null; readonly secretKeys:readonly string[]; readonly healthOperation:string; readonly actor:string; readonly trace:string }

export class InstallExtension {
  constructor(private readonly repositories:ExtensionRepositoryFactory, private readonly verifier:ManifestVerifier,
    private readonly contracts:ContractPolicy, private readonly loader:ExtensionLoader) {}

  async execute(database:OperationDatabase, input:ExtensionInstallRequest):Promise<InstalledExtension> {
    const registered=await this.repositories(database).manifest(input.provider);
    if (!registered) throw new Error('PROVIDER_MANIFEST_NOT_REGISTERED');
    const stored=manifestValue(registered.manifest,registered.signature);
    const parsed=Manifest.parse(stored,input.provider);
    if (parsed.value.version!==registered.version || parsed.value.contractVersion!==registered.contract_version
      || parsed.value.signature!==registered.signature || parsed.hash!==registered.manifest_hash.trim()) throw new Error('PROVIDER_MANIFEST_STORAGE_INVALID');
    if (!await this.verifier.verify(parsed.value)) throw new Error('EXTENSION_SIGNATURE_INVALID');
    this.contracts.assert(parsed.value,this.loader.definition(input.provider));
    new Extension(parsed);
    assertConfiguration(parsed.value,input);
    const installation=await this.repositories(database).install({ id:input.id,scope:input.scope,baseUrl:input.baseUrl,
      endpoints:input.endpoints,secretRef:input.secretRef,healthOperation:input.healthOperation,actor:input.actor,trace:input.trace,
      manifest:parsed.value,manifestHash:parsed.hash });
    return Object.freeze({ installation,manifest:parsed.value });
  }

  async reconfigure(database:OperationDatabase,id:string,scope:string,input:ExtensionConfiguration):Promise<void> {
    const repository=this.repositories(database); const current=await repository.lock(id,scope);
    if (!current) throw new Error('RESOURCE_NOT_FOUND');
    const registered=await repository.manifest(current.extension); if (!registered) throw new Error('PROVIDER_MANIFEST_NOT_REGISTERED');
    const parsed=Manifest.parse(manifestValue(registered.manifest,registered.signature),current.extension);
    if (!await this.verifier.verify(parsed.value)) throw new Error('EXTENSION_SIGNATURE_INVALID');
    this.contracts.assert(parsed.value,this.loader.definition(current.extension));
    assertConfiguration(parsed.value,{ ...input,id,provider:current.extension,scope });
    await repository.reconfigure(id,scope,input);
  }
}

function manifestValue(value:unknown, signature:string):unknown {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('PROVIDER_MANIFEST_INVALID');
  return { ...value as Record<string,unknown>,signature };
}

function assertConfiguration(manifest:ProviderManifest,input:ExtensionInstallRequest):void {
  if (input.healthOperation!==manifest.healthOperation) throw new Error('PROVIDER_HEALTH_OPERATION_MISMATCH');
  const keys=new Set(input.secretKeys);
  if (keys.size!==input.secretKeys.length || manifest.secretRefs.some((key)=>!keys.has(key))) throw new Error('PROVIDER_SECRET_REQUIRED');
  if (manifest.id==='private') {
    if (input.baseUrl!==null || input.secretRef!==null || Object.keys(input.endpoints).length!==0 || manifest.secretRefs.length!==0) {
      throw new Error('PRIVATE_PROVIDER_CONFIGURATION_INVALID');
    }
    return;
  }
  if (!input.baseUrl?.startsWith('https://') || !input.secretRef || !input.endpoints[manifest.healthOperation]?.startsWith('/')) {
    throw new Error('PROVIDER_CONNECTION_CONFIGURATION_INVALID');
  }
}
