import { canonical, digest, publicStagingHost, record, sameStrings, valueAt } from './readiness-common.mjs';

export const KNOWN_PRODUCTION_INSTANCE_ID = 'i-2zeewhay0farxq8lucrd';
export const KNOWN_STAGING_CANDIDATE_INSTANCE_ID = 'i-2zeewhay0farxq8lucrc';
export const KNOWN_PRODUCTION_INSTANCE_NAME = '福福网全域系统';
export const KNOWN_STAGING_CANDIDATE_CURRENT_NAME = '福福网-staging';
export const KNOWN_STAGING_CANDIDATE_TARGET_NAME = '福福网 staging';
export const KNOWN_STAGING_CANDIDATE_ZONE = 'cn-beijing-f';

const verificationClass = Object.freeze({
  P00: 'manual-attestation', P01: 'live', P02: 'manual-attestation', P03: 'manual-attestation',
  P04: 'manual-attestation', P05: 'mixed', P06: 'manual-attestation', P07: 'live',
  P08: 'manual-attestation', P09: 'mixed', P10: 'live', P11: 'manual-attestation', P12: 'mixed',
});

export const gates = Object.freeze({
  P00: ['cloudIdentity.region', 'cloudIdentity.accountId', 'cloudIdentity.principalFingerprint', 'cloudIdentity.sessionExpiresAt'],
  P01: ['candidate.commit', 'candidate.archiveSha256', 'candidate.inventorySha256', 'candidate.treeState'],
  P02: ['ownerIntegration.commit', 'ownerIntegration.migrationInventorySha256', 'ownerIntegration.invariantTestSha256', 'ownerIntegration.tenantBoundaryTestSha256'],
  P03: ['cloudIdentity.inventorySha256', 'network.productionEcsInstanceId',
    'network.productionEcsCurrentName', 'network.stagingCandidateEcsInstanceId',
    'network.stagingCandidateCurrentName', 'network.stagingCandidateTargetName',
    'network.stagingCandidateZone', 'network.existingHostInventorySha256'],
  P04: ['approval.approvedAt', 'approval.specificationSha256', 'approval.costEstimateSha256'],
  P05: ['cloudIdentity.resourceGroupId', 'network.ecsInstanceId', 'network.dedicatedStagingHostSha256',
    'network.vpcId', 'network.vSwitchId', 'network.securityGroupId', 'network.ecsRamRoleName',
    'network.publicAddressFingerprint',
    'rds.instanceId', 'rds.privateEndpointFingerprint', 'rds.publicEndpointAbsent',
    'tair.instanceId', 'tair.privateEndpointFingerprint', 'tair.publicEndpointAbsent'],
  P06: ['rds.tlsCertificateFingerprint', 'rds.deletionProtection', 'rds.backupPolicySha256', 'rds.restoreDrillSha256', 'tair.tlsCertificateFingerprint', 'tair.aofEnabled', 'tair.backupPolicySha256'],
  P07: ['hostConfiguration.environmentInventorySha256', 'hostConfiguration.secretCatalogKeySetSha256', 'hostConfiguration.internalTlsCertificateFingerprint', 'hostConfiguration.kmsMasterKeyFingerprint', 'hostConfiguration.rdsCaFingerprint', 'hostConfiguration.fileModeAuditSha256', 'hostConfiguration.hostToolchainSha256'],
  P08: ['sms.runtimeRoleName', 'sms.policyDocumentSha256', 'sms.signNameFingerprint', 'sms.templateCodeFingerprint', 'sms.filingEvidenceSha256', 'sms.imdsv2PrincipalFingerprint'],
  P09: ['database.rdsAdminInitReplaySha256', 'database.migrationReceiptSha256', 'database.boundaryReceiptSha256',
    'database.ownerBootstrapReceiptSha256', 'database.roleMatrixSha256', 'hostConfiguration.runtimeBoundarySha256'],
  P10: ['database.runtimeCompatibilitySha256', 'runtime.accountsHost', 'runtime.consoleHost', 'runtime.apiHost', 'runtime.listenerInventorySha256', 'runtime.systemdStateSha256', 'runtime.internalAccessProbeSha256', 'runtime.caddyValidationSha256', 'runtime.dnsResolutionSha256', 'runtime.publicNegativeRouteSha256'],
  P11: [
    'ownerInvitationE2e.invitationIdSha256',
    'ownerInvitationE2e.smsBizIdSha256',
    'ownerInvitationE2e.deliveredAt',
    'ownerInvitationE2e.membershipIdSha256',
    'ownerInvitationE2e.zeroPermissionAssertionSha256',
    'ownerInvitationE2e.replayDenialSha256',
    'ownerInvitationE2e.crossScopeDenialSha256',
    'ownerInvitationE2e.auditEventSha256',
  ],
  P12: ['fullJobs.databaseSchemaSha256', 'fullJobs.redisPingSha256', 'fullJobs.catalogSha256', 'fullJobs.extensionInventorySha256',
    'fullJobs.objectRoundTripSha256', 'fullJobs.schedulerOutboxSha256', 'fullJobs.providerSandboxSha256', 'fullJobs.systemdStateSha256'],
});

export function verifyGate(evidence, gate, live = []) {
  const requirements = gates[gate];
  if (requirements === undefined) fail('EVIDENCE_GATE_INVALID');
  const missing = [...requirements.filter((path) => !complete(valueAt(evidence, path), path)), ...live];
  const check = valueAt(evidence, `checks.${gate}`);
  if (check !== 'verified') missing.push(`checks.${gate}`);
  for (const dependency of Object.keys(gates).slice(0, Object.keys(gates).indexOf(gate))) {
    for (const path of gates[dependency]) {
      if (!complete(valueAt(evidence, path), path)) missing.push(`${path}:prerequisite`);
    }
    if (valueAt(evidence, `checks.${dependency}`) !== 'verified') missing.push(`checks.${dependency}:prerequisite`);
  }
  if (!Number.isFinite(Date.parse(valueAt(evidence, 'cloudIdentity.sessionExpiresAt')))
    || Date.parse(valueAt(evidence, 'cloudIdentity.sessionExpiresAt')) <= Date.now()) {
    missing.push(`cloudIdentity.sessionExpiresAt:${gate === 'P00' ? 'not-active' : 'prerequisite-not-active'}`);
  }
  const classification = gate === 'P07' && valueAt(evidence, 'checks.P09') === 'verified'
    ? 'historical-live-attestation'
    : verificationClass[gate];
  const status = missing.length > 0 ? 'pending'
    : classification === 'live' ? 'live-verified'
      : classification === 'mixed' ? 'live-verified-with-attestation'
        : classification === 'historical-live-attestation' ? 'historical-live-attested'
        : 'manual-attested';
  return Object.freeze({ gate, verificationClass: classification, status, missing: [...new Set(missing)] });
}

export function validateEvidence(evidence) {
  if (!record(evidence) || evidence.version !== 1 || evidence.profile !== 'full' || evidence.environment !== 'staging'
    || evidence.productionTrafficPercent !== 0 || evidence.productionDataAccess !== 'forbidden') {
    fail('EVIDENCE_BOUNDARY_INVALID');
  }
  const expected = new Set([
    'version', 'profile', 'environment', 'productionTrafficPercent', 'productionDataAccess',
    ...Object.values(gates).flat(), ...Object.keys(gates).map((gate) => `checks.${gate}`),
  ]);
  const actual = new Set(leafPaths(evidence));
  if (!sameStrings([...actual], [...expected])) fail('EVIDENCE_SCHEMA_INVALID');
  try { assertEcsTargetBoundary(evidence); }
  catch (cause) { fail(cause instanceof Error ? cause.message : 'EVIDENCE_ECS_TARGET_INVENTORY_INVALID'); }
  rejectSensitiveContent(evidence);
}

export function assertEcsTargetBoundary(evidence) {
  const inventory = Object.freeze({
    region: 'cn-beijing',
    production: Object.freeze({
      instanceId: valueAt(evidence, 'network.productionEcsInstanceId'),
      instanceName: valueAt(evidence, 'network.productionEcsCurrentName'),
    }),
    stagingCandidate: Object.freeze({
      instanceId: valueAt(evidence, 'network.stagingCandidateEcsInstanceId'),
      currentName: valueAt(evidence, 'network.stagingCandidateCurrentName'),
      targetName: valueAt(evidence, 'network.stagingCandidateTargetName'),
      zone: valueAt(evidence, 'network.stagingCandidateZone'),
    }),
  });
  const observed = [
    inventory.production.instanceId,
    inventory.production.instanceName,
    inventory.stagingCandidate.instanceId,
    inventory.stagingCandidate.currentName,
    inventory.stagingCandidate.targetName,
    inventory.stagingCandidate.zone,
  ];
  if (observed.every((value) => value === 'pending')) return;
  if (inventory.production.instanceId !== KNOWN_PRODUCTION_INSTANCE_ID
    || inventory.production.instanceName !== KNOWN_PRODUCTION_INSTANCE_NAME
    || inventory.stagingCandidate.instanceId !== KNOWN_STAGING_CANDIDATE_INSTANCE_ID
    || inventory.stagingCandidate.currentName !== KNOWN_STAGING_CANDIDATE_CURRENT_NAME
    || inventory.stagingCandidate.targetName !== KNOWN_STAGING_CANDIDATE_TARGET_NAME
    || inventory.stagingCandidate.zone !== KNOWN_STAGING_CANDIDATE_ZONE) {
    throw new Error('EVIDENCE_ECS_TARGET_INVENTORY_INVALID');
  }
  const recordedDigest = valueAt(evidence, 'network.existingHostInventorySha256');
  const expectedDigest = digest(canonical(inventory));
  if (recordedDigest !== 'pending' && recordedDigest !== expectedDigest) {
    throw new Error('EVIDENCE_ECS_TARGET_INVENTORY_DIGEST_INVALID');
  }
  const candidate = valueAt(evidence, 'network.ecsInstanceId');
  if (candidate === KNOWN_PRODUCTION_INSTANCE_ID) {
    throw new Error('EVIDENCE_PRODUCTION_ECS_SELECTED_AS_STAGING');
  }
  if (typeof candidate === 'string' && candidate !== 'pending'
    && candidate !== KNOWN_STAGING_CANDIDATE_INSTANCE_ID) {
    throw new Error('EVIDENCE_STAGING_ECS_TARGET_MISMATCH');
  }
}

function leafPaths(value, prefix = '') {
  if (!record(value)) return [prefix];
  return Object.entries(value).flatMap(([key, item]) => leafPaths(item, prefix ? `${prefix}.${key}` : key));
}

function complete(value, path) {
  if (value === undefined || value === null || value === '' || value === 'pending') return false;
  if (path === 'network.productionEcsCurrentName') return value === KNOWN_PRODUCTION_INSTANCE_NAME;
  if (path === 'network.stagingCandidateCurrentName') return value === KNOWN_STAGING_CANDIDATE_CURRENT_NAME;
  if (path === 'network.stagingCandidateTargetName') return value === KNOWN_STAGING_CANDIDATE_TARGET_NAME;
  if (path.endsWith('Sha256') || path.endsWith('Fingerprint') || path.endsWith('.commit')) return /^[a-f0-9]{64}$/.test(value) || (path.endsWith('.commit') && /^[a-f0-9]{40}$/.test(value));
  if (path.endsWith('At') || path.endsWith('ExpiresAt')) return typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (path.endsWith('Absent') || path.endsWith('Enabled') || path.endsWith('Protection')) return value === true;
  if (path === 'candidate.treeState') return value === 'clean';
  if (path === 'cloudIdentity.region') return value === 'cn-beijing';
  if (path.endsWith('Host')) return publicStagingHost(value);
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:/@-]{1,255}$/.test(value);
}

function rejectSensitiveContent(value, path = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectSensitiveContent(item, `${path}.${index}`));
    return;
  }
  if (!record(value)) {
    if (typeof value === 'string' && /(?:postgres(?:ql)?|redis|rediss):\/\/|-----BEGIN [A-Z ]+PRIVATE KEY-----|\bBearer\s+/iu.test(value)) {
      fail(`EVIDENCE_SECRET_VALUE_FORBIDDEN:${path}`);
    }
    if (typeof value === 'string' && (/(?:^|\D)1[3-9]\d{9}(?:\D|$)/u.test(value) || /^\d{4,8}$/u.test(value))) {
      fail(`EVIDENCE_PERSONAL_VALUE_FORBIDDEN:${path}`);
    }
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (/(?:password|passphrase|privatekey|accesskey|bearer|token|otp|phone|dsn|authorization)/iu.test(key)) {
      fail(`EVIDENCE_SECRET_KEY_FORBIDDEN:${path ? `${path}.` : ''}${key}`);
    }
    rejectSensitiveContent(item, path ? `${path}.${key}` : key);
  }
}

export function argumentsFrom(values) {
  let evidence;
  let check;
  let all = false;
  let json = false;
  let collectLive = false;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--evidence') evidence = values[++index];
    else if (value === '--check') check = values[++index];
    else if (value === '--all') all = true;
    else if (value === '--json') json = true;
    else if (value === '--collect-live') collectLive = true;
    else fail('EVIDENCE_ARGUMENT_INVALID');
  }
  if (typeof evidence !== 'string' || (!all && typeof check !== 'string') || (all && check !== undefined)) fail('EVIDENCE_ARGUMENT_INVALID');
  if (collectLive && !json) fail('EVIDENCE_COLLECT_REQUIRES_JSON');
  return Object.freeze({ evidence, check, all, json, collectLive });
}

export function fail(code) {
  process.stderr.write(`${code}\n`);
  process.exit(1);
}
