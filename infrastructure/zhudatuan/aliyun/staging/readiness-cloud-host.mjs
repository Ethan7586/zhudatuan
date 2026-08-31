import { request as httpRequest } from 'node:http';
import {
  KNOWN_PRODUCTION_PUBLIC_ADDRESS_SHA256,
  canonical,
  digest,
  matchEvidence,
  valueAt,
} from './readiness-common.mjs';
import {
  KNOWN_PRODUCTION_INSTANCE_ID,
  KNOWN_STAGING_CANDIDATE_CURRENT_NAME,
  KNOWN_STAGING_CANDIDATE_INSTANCE_ID,
  KNOWN_STAGING_CANDIDATE_TARGET_NAME,
  KNOWN_STAGING_CANDIDATE_ZONE,
} from './readiness-contract.mjs';

const METADATA_HOST = '100.100.100.200';
const STAGING_INSTANCE_NAMES = new Set([
  KNOWN_STAGING_CANDIDATE_CURRENT_NAME,
  KNOWN_STAGING_CANDIDATE_TARGET_NAME,
]);

export async function verifyLiveCloudHost(evidence, observed) {
  const missing = [];
  try {
    const token = await metadataRequest('/latest/api/token', 'PUT', {
      'x-aliyun-ecs-metadata-token-ttl-seconds': '60',
    });
    if (!token || token.length > 2048) throw new Error('IMDSV2_TOKEN_INVALID');
    const get = (path, optional = false) => metadata(token, path, optional);
    const [instanceId, instanceName, region, zone, ownerAccountId, vpcId, vSwitchId, privateAddress, roleListing,
      publicAddress, elasticAddress] = await Promise.all([
      get('instance-id'),
      get('instance/instance-name'),
      get('region-id'),
      get('zone-id'),
      get('owner-account-id'),
      get('vpc-id'),
      get('vswitch-id'),
      get('private-ipv4'),
      get('ram/security-credentials/'),
      get('public-ipv4', true),
      get('eipv4', true),
    ]);
    const roles = roleListing.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
    const publicAddresses = [...new Set([publicAddress, elasticAddress].filter(Boolean))];
    if (!safeCloudId(instanceId, 'i-') || instanceId !== KNOWN_STAGING_CANDIDATE_INSTANCE_ID
      || !STAGING_INSTANCE_NAMES.has(instanceName) || region !== 'cn-beijing' || zone !== KNOWN_STAGING_CANDIDATE_ZONE
      || !/^\d{4,32}$/u.test(ownerAccountId)
      || !safeCloudId(vpcId, 'vpc-') || !safeCloudId(vSwitchId, 'vsw-')
      || !privateIpv4(privateAddress) || roles.length !== 1 || !safeName(roles[0])
      || publicAddresses.length !== 1 || !ipv4(publicAddresses[0])
      || digest(publicAddresses[0]) === KNOWN_PRODUCTION_PUBLIC_ADDRESS_SHA256) {
      throw new Error('CLOUD_HOST_IDENTITY_INVALID');
    }
    const publicIpv4 = publicAddresses[0];
    matchEvidence(evidence, 'cloudIdentity.region', region, missing, observed);
    matchEvidence(evidence, 'cloudIdentity.accountId', ownerAccountId, missing, observed);
    matchEvidence(evidence, 'network.stagingCandidateEcsInstanceId', instanceId, missing, observed);
    matchEvidence(evidence, 'network.stagingCandidateZone', zone, missing, observed);
    matchEvidence(evidence, 'network.ecsInstanceId', instanceId, missing, observed);
    matchEvidence(evidence, 'network.vpcId', vpcId, missing, observed);
    matchEvidence(evidence, 'network.vSwitchId', vSwitchId, missing, observed);
    matchEvidence(evidence, 'network.ecsRamRoleName', roles[0], missing, observed);
    matchEvidence(evidence, 'network.publicAddressFingerprint', digest(publicIpv4), missing, observed);
    matchEvidence(evidence, 'network.dedicatedStagingHostSha256', digest(canonical({
      instanceId, instanceName, ownerAccountId, privateAddress, publicAddress: publicIpv4,
      ramRoleName: roles[0], region, vpcId, vSwitchId, zone,
    })), missing, observed);
  } catch {
    missing.push('live:aliyun-imdsv2:dedicated-staging-host');
  }
  if (valueAt(evidence, 'network.ecsInstanceId') === KNOWN_PRODUCTION_INSTANCE_ID) {
    missing.push('live:network.ecsInstanceId:production-forbidden');
  }
  if (valueAt(evidence, 'network.ecsInstanceId') !== KNOWN_STAGING_CANDIDATE_INSTANCE_ID
    || valueAt(evidence, 'network.stagingCandidateEcsInstanceId') !== KNOWN_STAGING_CANDIDATE_INSTANCE_ID) {
    missing.push('live:network.ecsInstanceId:staging-target-mismatch');
  }
  return [...new Set(missing)];
}

async function metadata(token, item, optional = false) {
  try {
    return await metadataRequest(`/latest/meta-data/${item}`, 'GET', {
      'x-aliyun-ecs-metadata-token': token,
    });
  } catch (cause) {
    if (optional && cause instanceof Error && cause.message === 'IMDS_STATUS_404') return '';
    throw cause;
  }
}

function metadataRequest(path, method, headers) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: METADATA_HOST, port: 80, path, method, headers, timeout: 2_000 }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.byteLength;
        if (size > 4096) request.destroy(new Error('IMDS_RESPONSE_TOO_LARGE'));
        else chunks.push(chunk);
      });
      response.once('end', () => {
        if (response.statusCode !== 200) reject(new Error(`IMDS_STATUS_${response.statusCode ?? 0}`));
        else resolve(Buffer.concat(chunks).toString('utf8').trim());
      });
    });
    request.once('timeout', () => request.destroy(new Error('IMDS_TIMEOUT')));
    request.once('error', reject);
    request.end();
  });
}

function safeCloudId(value, prefix) {
  return typeof value === 'string' && value.startsWith(prefix) && /^[A-Za-z0-9-]{8,128}$/u.test(value);
}

function safeName(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.:@-]{1,128}$/u.test(value);
}

function ipv4(value) {
  const octets = typeof value === 'string' ? value.split('.').map(Number) : [];
  return octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255);
}

function privateIpv4(value) {
  if (!ipv4(value)) return false;
  const [first, second] = value.split('.').map(Number);
  return first === 10 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168;
}
