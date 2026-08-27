import { describe,expect,it } from 'vitest';
import { PROVIDER_API_VERSION,type ProviderManifest } from '@shop/contract';
import { ContractPolicy } from './ContractPolicy';

const signed:ProviderManifest={ id:'sample',kind:'channel',priority:1,version:'1.0.0',apiVersion:PROVIDER_API_VERSION,
  contractVersion:'sample.v1',healthOperation:'health',capabilities:['Catalog'],permissions:['channel.sample.operate'],
  configSchema:'provider.sample.v1',eventSubscriptions:[],secretRefs:['credential'],limits:{ connectionTimeoutMs:1,
    responseTimeoutMs:1,totalDeadlineMs:1,maxConcurrency:1,requestsPerSecond:1,maxAttempts:1,failureThreshold:1,recoveryMs:100 },signature:'signed' };

describe('ContractPolicy',()=>{
  it('requires an exact host definition',()=>expect(()=>new ContractPolicy().assert(signed,{ ...signed,signature:undefined } as never)).not.toThrow());
  it('rejects any contract drift',()=>expect(()=>new ContractPolicy().assert({ ...signed,contractVersion:'sample.v0' },
    { ...signed,signature:undefined } as never)).toThrow('EXTENSION_CONTRACT_MISMATCH'));
});
