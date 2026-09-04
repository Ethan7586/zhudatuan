import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ExtensionListRow, ExtensionRepository, InstallInput, RegisteredManifest } from '../../01_public_gongkai/ExtensionLoader';
import type { HealthRecord } from '../../02_domain_yewu/model/HealthRecord';
import { Installation, type InstallationState } from '../../02_domain_yewu/model/Installation';

interface InstallationRow { readonly id:string; readonly extension_id:string; readonly extension_version:string; readonly scope_id:string;
  readonly status:InstallationState; readonly version:number }

export class PgExtensionRepository implements ExtensionRepository {
  constructor(private readonly database: OperationDatabase) {}

  async manifest(provider: string): Promise<RegisteredManifest|null> {
    const result=await this.database.query<RegisteredManifest>(`select manifest.id,manifest.version,manifest.manifest,manifest.manifest_hash,
      manifest.signature,manifest.contract_version,contract.status contract_status,contract.schema_hash from extension.manifest manifest
      join extension.contractversion contract on contract.extension_id=manifest.id and contract.contract_version=manifest.contract_version
      where manifest.id=$1 and contract.status='verified' order by manifest.registered_at desc limit 1`,[provider]);
    return result.rows[0]??null;
  }

  async install(input: InstallInput): Promise<Installation> {
    const result=await this.database.query<InstallationRow>(`insert into extension.installation(id,extension_id,extension_version,scope_id,status,
      manifest,base_url,endpoints,secret_ref,health_operation,version,installed_at) values($1,$2,$3,$4,'disabled',$5::jsonb,$6,$7::jsonb,$8,$9,0,
      clock_timestamp()) returning id,extension_id,extension_version,scope_id,status,version`,[input.id,input.manifest.id,input.manifest.version,
      input.scope,JSON.stringify(input.manifest),input.baseUrl,JSON.stringify(input.endpoints),input.secretRef,input.healthOperation]);
    const row=result.rows[0]; if (!row) throw new Error('EXTENSION_INSTALL_FAILED');
    await this.history(row.id,null,'disabled',input.actor,{ reason:'installed', manifestHash:input.manifestHash });
    return installation(row);
  }

  async reconfigure(id:string,scope:string,input:Readonly<{baseUrl:string|null;endpoints:Readonly<Record<string,string>>;secretRef:string|null;
    healthOperation:string;actor:string;trace:string}>):Promise<Installation> {
    const current=await this.lock(id,scope); if (!current) throw new Error('RESOURCE_NOT_FOUND');
    if (current.state!=='disabled') throw new Error('EXTENSION_RECONFIGURE_STATE_INVALID');
    const result=await this.database.query<InstallationRow>(`update extension.installation set base_url=$3,endpoints=$4::jsonb,secret_ref=$5,
      health_operation=$6,version=version+1 where id=$1 and scope_id=$2 and status='disabled' and version=$7
      returning id,extension_id,extension_version,scope_id,status,version`,[id,scope,input.baseUrl,JSON.stringify(input.endpoints),
      input.secretRef,input.healthOperation,current.version]);
    const row=result.rows[0]; if (!row) throw new Error('EXTENSION_VERSION_CONFLICT');
    await this.history(id,'disabled','disabled',input.actor,{ reason:'configuration changed',trace:input.trace });
    return installation(row);
  }

  async lock(id: string, scope: string): Promise<Installation|null> {
    const result=await this.database.query<InstallationRow>(`select id,extension_id,extension_version,scope_id,status,version
      from extension.installation where id=$1 and scope_id=$2 for update`,[id,scope]);
    return result.rows[0] ? installation(result.rows[0]) : null;
  }

  async activation(id:string,scope:string,provider:string):Promise<Readonly<{candidate:Installation;active:Installation|null}>> {
    const result=await this.database.query<InstallationRow>(`select id,extension_id,extension_version,scope_id,status,version
      from extension.installation where scope_id=$2 and extension_id=$3 and (id=$1 or status='enabled') order by id for update`,[id,scope,provider]);
    const candidate=result.rows.find((row)=>row.id===id); if (!candidate) throw new Error('RESOURCE_NOT_FOUND');
    const active=result.rows.find((row)=>row.id!==id && row.status==='enabled');
    return Object.freeze({ candidate:installation(candidate),active:active?installation(active):null });
  }

  async transition(current: Installation, next: InstallationState, actor: string, evidence: unknown): Promise<Installation> {
    const transitioned=current.transition(next);
    const result=await this.database.query<InstallationRow>(`update extension.installation set status=$3,version=version+1 where id=$1 and scope_id=$2
      and status=$4 and version=$5 returning id,extension_id,extension_version,scope_id,status,version`,
    [current.id,current.scope,next,current.state,current.version]);
    const row=result.rows[0]; if (!row || row.version!==transitioned.version) throw new Error('EXTENSION_VERSION_CONFLICT');
    await this.history(current.id,current.state,next,actor,evidence);
    if (next==='enabled' || next==='disabled' || next==='degraded') {
      await this.database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
        occurred_at,available_at) values('event:'||gen_random_uuid(),$1,1,'extension',$2,$3,
        jsonb_build_object('installation',$2,'provider',$4,'state',$5,'version',$6),$7,clock_timestamp(),clock_timestamp())`,
      [`extension.${next}`,current.id,current.scope,current.extension,next,row.version,evidenceTrace(evidence)]);
    }
    return installation(row);
  }

  async health(record: HealthRecord): Promise<void> {
    await this.database.query(`insert into extension.health(installation_id,checked_at,connection_version,state,latency_ms,reason)
      values($1,$2,$3,$4,$5,$6) on conflict(installation_id,checked_at) do nothing`,
    [record.installation,record.checkedAt,record.version,record.state,record.latency,record.reason??null]);
  }

  async enqueueHealth(id: string, scope: string, delaySeconds=0): Promise<void> {
    await this.database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values('job:extensionhealth:'||$1||':'||to_char(date_trunc('minute',clock_timestamp()+make_interval(secs=>$3)),'YYYYMMDDHH24MI'),
        'extensionhealth','extension',$2,jsonb_build_object('installation',$1),'queued',40,
        clock_timestamp()+make_interval(secs=>$3),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,[id,scope,delaySeconds]);
  }

  async enqueueScan(delaySeconds=60): Promise<void> {
    await this.database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values('job:extensionhealth:scan:'||to_char(date_trunc('minute',clock_timestamp()+make_interval(secs=>$1)),'YYYYMMDDHH24MI'),
      'extensionhealth','extension',null,'{"scan":true}'::jsonb,'queued',50,clock_timestamp()+make_interval(secs=>$1),clock_timestamp(),
      clock_timestamp()) on conflict(id) do nothing`,[delaySeconds]);
  }

  async list(cursor: Readonly<{sort:string|null;id:string|null}>, fetch: number): Promise<readonly ExtensionListRow[]> {
    const result=await this.database.query<ExtensionListRow>(`select installation.id,installation.extension_id,installation.extension_version,
      installation.scope_id,installation.status,installation.manifest,installation.version,installation.installed_at,
      health.state health_state,health.latency_ms health_latency_ms,health.reason health_reason,health.checked_at
      from extension.installation installation left join lateral(select state,latency_ms,reason,checked_at from extension.health
        where installation_id=installation.id order by checked_at desc limit 1) health on true where access.scope_allowed(installation.scope_id)
      and ($1::timestamptz is null or (installation.installed_at,installation.id)<($1::timestamptz,$2))
      order by installation.installed_at desc,installation.id desc limit $3`,[cursor.sort,cursor.id,fetch]);
    return result.rows;
  }

  async targets(limit: number) {
    const result=await this.database.query<{id:string;scope_id:string;extension_id:string;status:InstallationState}>(`select id,scope_id,
      extension_id,status from extension.installation where status in('testing','enabled','degraded') order by installed_at,id limit $1`,[limit]);
    return result.rows;
  }

  async summaries(ids:readonly string[]) {
    if (ids.length===0) return [];
    const result=await this.database.query<import('../../01_public_gongkai/ExtensionLoader').ExtensionSummary>(`select installation.id,
      installation.manifest->'capabilities' capabilities,health.state health_state,health.latency_ms health_latency_ms,
      health.reason health_reason,health.checked_at from extension.installation installation left join lateral(
        select state,latency_ms,reason,checked_at from extension.health where installation_id=installation.id
        order by checked_at desc limit 1) health on true where installation.id=any($1::text[])`,[ids]);
    return result.rows;
  }

  private async history(id: string, previous: InstallationState|null, next: InstallationState, actor: string, evidence: unknown): Promise<void> {
    await this.database.query(`insert into extension.activationhistory(installation_id,sequence,previous_state,next_state,actor_id,evidence,occurred_at)
      select $1,coalesce(max(sequence),0)+1,$2,$3,$4,$5::jsonb,clock_timestamp() from extension.activationhistory where installation_id=$1`,
    [id,previous,next,actor,JSON.stringify(evidence)]);
  }
}

function installation(row: InstallationRow): Installation {
  return new Installation(row.id,row.extension_id,row.extension_version,row.scope_id,row.status,Number(row.version));
}

function evidenceTrace(value: unknown): string {
  if (value && typeof value==='object' && !Array.isArray(value) && typeof Reflect.get(value,'trace')==='string') return Reflect.get(value,'trace') as string;
  throw new Error('EXTENSION_TRACE_REQUIRED');
}
