export class DeliveryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DeliveryError';
    this.code = code;
    this.details = details;
  }
}

export function invariant(condition, code, message, details = {}) {
  if (!condition) throw new DeliveryError(code, message, details);
}

export function asDeliveryError(error) {
  if (error instanceof DeliveryError) return error;
  return new DeliveryError(error?.code ?? 'DELIVERY_UNEXPECTED', error instanceof Error ? error.message : String(error), {
    cause: error instanceof Error ? error.stack : undefined,
    status: error?.status ?? error?.statusCode,
    ...(error?.details ?? {}),
  });
}

export const DELIVERY_ERROR_CATEGORIES = Object.freeze([
  'TRANSIENT', 'CONFIGURATION', 'SECURITY_DENIAL', 'INTEGRITY_CONFLICT', 'DEPENDENCY_UNAVAILABLE',
]);

export function deliveryErrorContract(error, context = {}) {
  const value = asDeliveryError(error);
  const status = Number(value.details?.status ?? value.status ?? 0);
  const detail = String(value.details?.detail ?? value.message ?? '');
  const category = context.category ?? errorCategory(value.code, status, detail);
  const securityDenial = category === 'SECURITY_DENIAL';
  const transient = category === 'TRANSIENT';
  const diagnosis = diagnoseAccessDenial(status, detail);
  const nextSafeAction = context.nextSafeAction ?? (value.code === 'OSS_LIST_FAILED' && securityDenial
    ? 'repair-minimal-ram-policy-and-rerun-doctor'
    : transient ? 'retry-same-readiness-check' : 'stop-and-review-readiness-evidence');
  return Object.freeze({
    code: value.code,
    category,
    stage: context.stage ?? value.details?.stage ?? 'unknown',
    retryable: context.retryable ?? (transient && status !== 401 && status !== 403),
    attempts: Number(context.attempts ?? value.details?.attempts ?? 1),
    requestId: context.requestId ?? null,
    affectedCapability: context.affectedCapability ?? 'unknown',
    evidence: context.evidence ?? evidenceSummary(value.code, status, diagnosis),
    nextSafeAction,
    resumeAllowed: context.resumeAllowed ?? false,
    redactedDetails: redactDeliveryDetails({ status: status || undefined, diagnosis, ...context.details }, context.secretValues),
  });
}

export function redactDeliveryDetails(value, secretValues = []) {
  const secrets = (secretValues ?? []).filter((item) => typeof item === 'string' && item.length > 0);
  const visit = (item, key = '') => {
    if (/(?:secret|token|credential|authorization|access.?key)/i.test(key)) return '[REDACTED]';
    if (Array.isArray(item)) return item.map((entry) => visit(entry));
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).map(([name, entry]) => [name, visit(entry, name)]));
    if (typeof item !== 'string') return item;
    let text = item;
    for (const secret of secrets) text = text.replaceAll(secret, '[REDACTED]');
    return text.replace(/(OSSAccessKeyId|Signature|security-token)=[^&\s]+/gi, '$1=[REDACTED]');
  };
  return visit(value);
}

export function diagnoseAccessDenial(status, detail) {
  const candidates = [];
  if (/NoSuchBucket|specified bucket does not exist/i.test(detail)) candidates.push('BUCKET_NAME_MISMATCH');
  if (/bucket you access does not belong to you/i.test(detail)) {
    candidates.push('BUCKET_NAME_MISMATCH');
    candidates.push('RAM_PRINCIPAL_ACCOUNT_OWNERSHIP_MISMATCH');
  }
  if (/ResourceGroupLevelIdentityBasedPolicy/i.test(detail)) candidates.push('RESOURCE_GROUP_NOT_AUTHORIZED');
  if (/<AuthPrincipalType>SubUser<\/AuthPrincipalType>/i.test(detail)) candidates.push('RAM_SUBUSER_IDENTITY');
  if (/ImplicitDeny/i.test(detail)) candidates.push('IDENTITY_POLICY_IMPLICIT_DENY');
  if (/ExplicitDeny|explicit deny/i.test(detail)) candidates.push('EXPLICIT_DENY');
  if (/prefix/i.test(detail) && /deny|forbidden|not authorized/i.test(detail)) candidates.push('PREFIX_NOT_AUTHORIZED');
  if (/endpoint|region/i.test(detail)) candidates.push('ENDPOINT_REGION_MISMATCH');
  if ((status === 401 || status === 403) && candidates.length === 0) candidates.push('SECURITY_POLICY_DENIAL_UNCLASSIFIED');
  return Object.freeze({ httpStatus: status || null, candidateCauses: candidates });
}

function errorCategory(code, status, detail) {
  if (status === 401 || status === 403 || /DENIED|FORBIDDEN|UNAUTHORIZED|SUBJECT_NOT_ALLOWED|AUDIENCE_MISMATCH|ROLE_CAPABILITY/.test(code) || /AccessDenied/i.test(detail)) return 'SECURITY_DENIAL';
  if (/CONFLICT|MISMATCH|DIGEST|TAMPER/.test(code)) return 'INTEGRITY_CONFLICT';
  if (/REQUIRED|INVALID|CONFIG|BUCKET|ENDPOINT|PREFIX|NOT_EXPLICITLY_ALLOWED|CREDENTIAL_EXPIRED|TRUST_RELATIONSHIP/.test(code)) return 'CONFIGURATION';
  if (status === 408 || status === 429 || (status >= 500 && status <= 504) || /TIMEOUT|RESET|UNREACH|TRANSIENT/.test(code)) return 'TRANSIENT';
  return 'DEPENDENCY_UNAVAILABLE';
}

function evidenceSummary(code, status, diagnosis) {
  const causes = diagnosis.candidateCauses.join(',') || 'unclassified';
  return `${code}${status ? ` HTTP ${status}` : ''}; candidates=${causes}`;
}
