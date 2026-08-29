import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

if (process.argv[2] !== 'local-disposable-fixture') {
  throw new Error('POSTGRES_INIT_FIXTURE_CONFIRMATION_REQUIRED');
}

const execute = promisify(execFile);
const suffix = `${process.pid}-${randomBytes(3).toString('hex')}`;
const network = `zdt-pg16-init-${suffix}`;
const server = `zdt-pg16-init-server-${suffix}`;
const client = `zdt-pg16-init-client-${suffix}`;
const temporary = await mkdtemp(join(tmpdir(), 'zdt-pg16-init-'));
const environmentFile = join(temporary, 'fixture.env');
const containerScript = '/workspace/infrastructure/zhudatuan/aliyun/postgres-init-registration.sh';
const projectRoles = [
  'anon','authenticated','service_role','shopapp','shopjob','shopmigration','shopread',
  'zhudatuanidentityapi','zhudatuanidentityjob','zhudatuanbootstrap','zhudatuanwebapi',
  'zhudatuanpurchaseapi','zhudatuansandboxbootstrap','zhudatuanregistrationboundary',
];
const passwordNames = [
  'SHOPAPP_PASSWORD','SHOPJOB_PASSWORD','SHOPMIGRATION_PASSWORD','SHOPREAD_PASSWORD',
  'ZHUDATUAN_IDENTITY_API_PASSWORD','ZHUDATUAN_IDENTITY_JOB_PASSWORD','ZHUDATUAN_BOOTSTRAP_PASSWORD',
  'ZHUDATUAN_WEB_API_PASSWORD','ZHUDATUAN_PURCHASE_API_PASSWORD','ZHUDATUAN_SANDBOX_BOOTSTRAP_PASSWORD',
];
const sentinel = randomBytes(36).toString('base64url');

try {
  await docker(['network','create',network]);
  await docker([
    'run','--rm','-d','--name',server,'--network',network,
    '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_DB=zhudatuan_registration','postgres:16',
  ]);
  await waitForPostgres();
  await psql('create role zhudatuanregistrationboundary nologin noinherit;');
  const inspection = JSON.parse((await docker(['inspect',server])).stdout)[0];
  const serverAddress = inspection.NetworkSettings.Networks[network].IPAddress;
  if (!serverAddress) throw new Error('POSTGRES_INIT_FIXTURE_PRIVATE_ADDRESS_MISSING');

  const pristine = await snapshot();
  await expectRejected(
    { ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR: serverAddress==='10.255.255.254'?'172.31.255.254':'10.255.255.254' },
    'ZHUDATUAN_RDS_INIT_SERVER_ADDRESS_INVALID',
  );
  assertSnapshot(pristine,await snapshot(),'wrong-address');

  await psql('create table public.registration_init_wrong_target_fixture(id integer);');
  const nonempty = await snapshot();
  await expectRejected({},'ZHUDATUAN_RDS_INIT_PRISTINE_TARGET_REQUIRED',serverAddress);
  assertSnapshot(nonempty,await snapshot(),'nonempty-database');
  await psql('drop table public.registration_init_wrong_target_fixture;');

  await runInit({},serverAddress);
  const initialized = await snapshot();
  await expectRejected(
    { ZHUDATUAN_DATABASE_SENTINEL: randomBytes(36).toString('base64url') },
    'ZHUDATUAN_RDS_INIT_EXISTING_TARGET_INVALID',
    serverAddress,
  );
  assertSnapshot(initialized,await snapshot(),'wrong-sentinel');

  await runInit({},serverAddress);
  const proof = (await psql(`select current_setting('server_version_num')::integer between 160000 and 169999,
    (select pg_get_userbyid(datdba) from pg_database where datname=current_database()),
    (select count(*) from pg_auth_members where roleid='zhudatuanregistrationboundary'::regrole
      or member='zhudatuanregistrationboundary'::regrole),
    (select count(*) from deployment.boundary),
    (select count(*) from pg_roles where rolname=any(array[${projectRoles.map((role)=>`'${role}'`).join(',')}]))`)).stdout.trim();
  if (proof!=='t|shopmigration|0|1|14') throw new Error(`POSTGRES_INIT_FIXTURE_FINAL_STATE_INVALID:${proof}`);
  process.stdout.write('postgres init PG16 fixture passed: positive=2 wrong-address=1 nonempty=1 wrong-sentinel=1 zero-mutation=3 boundary-memberships=0\n');
} finally {
  await docker(['rm','-f',client],true);
  await docker(['rm','-f',server],true);
  await docker(['network','rm',network],true);
  await rm(temporary,{ recursive:true,force:true });
}

async function runInit(overrides={},serverAddress) {
  const values = {
    POSTGRES_USER:'postgres',POSTGRES_DB:'zhudatuan_registration',PGHOST:server,PGPORT:'5432',
    PGPASSWORD:randomBytes(32).toString('base64url'),
    ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR:serverAddress,
    ZHUDATUAN_DATABASE_SENTINEL:sentinel,
  };
  for (const name of passwordNames) values[name]=randomBytes(32).toString('base64url');
  Object.assign(values,overrides);
  await writeFile(environmentFile,Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{ mode:0o600 });
  await chmod(environmentFile,0o600);
  const result = await docker([
    'run','--rm','--name',client,'--network',network,'--env-file',environmentFile,
    '-v',`${repositoryRoot}:/workspace:ro`,'postgres:16','/bin/sh',containerScript,
  ],true);
  const transcript=`${result.stdout}${result.stderr}`;
  for (const name of ['PGPASSWORD','ZHUDATUAN_DATABASE_SENTINEL',...passwordNames]) {
    if (transcript.includes(values[name])) throw new Error(`POSTGRES_INIT_FIXTURE_SECRET_OUTPUT:${name}`);
  }
  if (result.exitCode!==0) {
    const error=new Error('POSTGRES_INIT_FIXTURE_COMMAND_REJECTED');
    error.stderr=result.stderr;
    throw error;
  }
  return result;
}

async function expectRejected(overrides,marker,serverAddress) {
  try {
    await runInit(overrides,serverAddress);
  } catch (error) {
    if (String(error.stderr??error.message).includes(marker)) return;
    throw new Error(`POSTGRES_INIT_FIXTURE_WRONG_REJECTION:${marker}`,{ cause:error });
  }
  throw new Error(`POSTGRES_INIT_FIXTURE_UNEXPECTED_SUCCESS:${marker}`);
}

async function snapshot() {
  const roleArray = `array[${projectRoles.map((role)=>`'${role}'`).join(',')}]`;
  const base = (await psql(`select jsonb_build_object(
    'owner',(select pg_get_userbyid(datdba) from pg_database where datname=current_database()),
    'schemas',(select coalesce(jsonb_agg(jsonb_build_array(nspname,pg_get_userbyid(nspowner)) order by nspname),'[]')
      from pg_namespace where nspname!~'^pg_'),
    'relations',(select coalesce(jsonb_agg(jsonb_build_array(namespace.nspname,relation.relname,
        relation.relkind,pg_get_userbyid(relation.relowner)) order by namespace.nspname,relation.relname),'[]')
      from pg_class relation join pg_namespace namespace on namespace.oid=relation.relnamespace
      where namespace.nspname!~'^pg_'),
    'functions',(select coalesce(jsonb_agg(jsonb_build_array(namespace.nspname,function.oid::regprocedure::text,
        pg_get_userbyid(function.proowner),md5(pg_get_functiondef(function.oid)),function.proacl::text)
        order by namespace.nspname,function.oid::regprocedure::text),'[]')
      from pg_proc function join pg_namespace namespace on namespace.oid=function.pronamespace
      where namespace.nspname!~'^pg_' and namespace.nspname<>'information_schema'),
    'roles',(select coalesce(jsonb_agg(to_jsonb(role_state) order by rolname),'[]') from (
      select rolname,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolcanlogin,rolreplication,rolbypassrls
      from pg_roles where rolname=any(${roleArray})) role_state),
    'memberships',(select coalesce(jsonb_agg(jsonb_build_array(granted.rolname,member.rolname,grantor.rolname,
        membership.admin_option,membership.inherit_option,membership.set_option)
        order by granted.rolname,member.rolname,grantor.rolname),'[]')
      from pg_auth_members membership join pg_roles granted on granted.oid=membership.roleid
      join pg_roles member on member.oid=membership.member join pg_roles grantor on grantor.oid=membership.grantor
      where granted.rolname=any(${roleArray}) or member.rolname=any(${roleArray})),
    'extensions',(select coalesce(jsonb_agg(extname order by extname),'[]') from pg_extension),
    'boundary',to_regclass('deployment.boundary')::text)::text`)).stdout.trim();
  const boundary = base.includes('"boundary": "deployment.boundary"')
    ? (await psql("select jsonb_agg(to_jsonb(boundary) order by id)::text from deployment.boundary boundary")).stdout.trim()
    : null;
  return JSON.stringify({base,boundary});
}

function assertSnapshot(before,after,label) {
  if (before!==after) throw new Error(`POSTGRES_INIT_FIXTURE_MUTATION_LEAK:${label}`);
}

async function waitForPostgres() {
  let consecutive=0;
  for (let attempt=0;attempt<120;attempt+=1) {
    const result = await docker(['exec',server,'psql','-X','-U','postgres','-d','zhudatuan_registration',
      '-At','-c',"select not pg_is_in_recovery() and current_database()='zhudatuan_registration'"],true);
    consecutive=result.exitCode===0 && result.stdout.trim()==='t' ? consecutive+1 : 0;
    if (consecutive>=8) return;
    await new Promise((resolve)=>setTimeout(resolve,250));
  }
  throw new Error('POSTGRES_INIT_FIXTURE_START_TIMEOUT');
}

async function psql(sql) {
  return docker(['exec',server,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','zhudatuan_registration','-At','-F','|','-c',sql]);
}

async function docker(args,allowFailure=false) {
  try {
    const result = await execute('docker',args,{ encoding:'utf8',maxBuffer:4*1024*1024,timeout:120_000 });
    return { ...result,exitCode:0 };
  } catch (error) {
    if (allowFailure) return { stdout:error.stdout??'',stderr:error.stderr??'',exitCode:error.code??1 };
    throw error;
  }
}
