import { createHash } from 'node:crypto';
import { describe,expect,it } from 'vitest';
import { manifestPayload,PROVIDER_API_VERSION,type ProviderManifest } from '@shop/contract';
import { Manifest } from '../../02_domain_yewu/model/Manifest';

const value:ProviderManifest={ id:'sample',kind:'channel',priority:1,version:'1.2.3',apiVersion:PROVIDER_API_VERSION,
  contractVersion:'sample.v1',healthOperation:'health',capabilities:['Catalog'],permissions:['sample.read'],
  configSchema:'sample.v1',eventSubscriptions:[],secretRefs:['credential'],limits:{ connectionTimeoutMs:100,
    responseTimeoutMs:200,totalDeadlineMs:300,maxConcurrency:2,requestsPerSecond:5,maxAttempts:2,failureThreshold:3,
    recoveryMs:1000 },signature:'c2lnbmVk' };

describe('Manifest',()=>{
  it('parses the complete signed contract and hashes its canonical unsigned payload',()=>{
    const manifest=Manifest.parse(value,'sample');
    expect(manifest.hash).toBe(createHash('sha256').update(manifestPayload(value)).digest('hex'));
    expect(manifest.value.healthOperation).toBe('health');
  });
  it('rejects duplicate capabilities and unsafe limits',()=>{
    expect(()=>Manifest.parse({ ...value,capabilities:['Catalog','Catalog'] })).toThrow('PROVIDER_MANIFEST_CAPABILITY_INVALID');
    expect(()=>Manifest.parse({ ...value,limits:{ ...value.limits,maxConcurrency:65 } })).toThrow('PROVIDER_CONCURRENCY_INVALID');
  });
});
