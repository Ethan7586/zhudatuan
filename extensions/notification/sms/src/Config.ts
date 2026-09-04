import { secretRef, type SecretRef } from '@shop/contract';

export interface SmsConfiguration {
  readonly signName: string;
  readonly verificationTemplate: string;
  readonly templates: Readonly<{
    transactional: Readonly<Record<string, string>>;
    marketing: Readonly<Record<string, string>>;
  }>;
  readonly optOut: Readonly<{
    variable: string;
    text: string;
    keywords: readonly string[];
  }>;
  readonly endpoint: string;
  readonly region: string;
  readonly credentialRef: SecretRef | null;
  readonly roleName: string | null;
}

export interface SmsCredential {
  readonly accessKeyId: string;
  readonly accessKeySecret: string;
}

export function parseSmsConfiguration(value: unknown): SmsConfiguration {
  const source = record(value, 'SMS_CONFIGURATION_INVALID');
  const allowed = ['credentialRef', 'endpoint', 'optOut', 'region', 'roleName', 'signName', 'templates', 'verificationTemplate'];
  if (Object.keys(source).some((key) => !allowed.includes(key))) throw new Error('SMS_CONFIGURATION_INVALID');
  const credentialRef = source.credentialRef === null || source.credentialRef === undefined ? null : secretRef(source.credentialRef);
  const roleName = source.roleName === null || source.roleName === undefined ? null : text(source.roleName, 'SMS_ROLE_INVALID', 2, 64);
  if ((credentialRef === null) === (roleName === null)) throw new Error('SMS_CREDENTIAL_SOURCE_INVALID');
  const endpoint = text(source.endpoint, 'SMS_ENDPOINT_INVALID', 3, 255);
  if (!/^[a-z0-9.-]+\.aliyuncs\.com$/.test(endpoint)) throw new Error('SMS_ENDPOINT_INVALID');
  const verificationTemplate = templateCode(source.verificationTemplate);
  const templates = templateMappings(source.templates);
  const optOut = optOutPolicy(source.optOut);
  const codes = [verificationTemplate, ...Object.values(templates.transactional), ...Object.values(templates.marketing)];
  if (new Set(codes).size !== codes.length) throw new Error('SMS_TEMPLATE_PURPOSE_OVERLAP');
  return Object.freeze({
    signName: text(source.signName, 'SMS_SIGN_INVALID', 1, 100),
    verificationTemplate,
    templates,
    optOut,
    endpoint,
    region: text(source.region, 'SMS_REGION_INVALID', 2, 64),
    credentialRef,
    roleName,
  });
}

function templateMappings(value: unknown): SmsConfiguration['templates'] {
  const source = record(value, 'SMS_TEMPLATE_MAPPING_INVALID');
  if (Object.keys(source).sort().join(',') !== 'marketing,transactional') throw new Error('SMS_TEMPLATE_MAPPING_INVALID');
  return Object.freeze({ transactional: templateMap(source.transactional), marketing: templateMap(source.marketing) });
}

function templateMap(value: unknown): Readonly<Record<string, string>> {
  const source = record(value, 'SMS_TEMPLATE_MAPPING_INVALID');
  const entries = Object.entries(source);
  if (entries.length > 200) throw new Error('SMS_TEMPLATE_MAPPING_INVALID');
  const mapped: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (!/^[a-z][a-z0-9.:-]{2,127}$/.test(key)) throw new Error('SMS_TEMPLATE_MAPPING_INVALID');
    mapped[key] = templateCode(value);
  }
  return Object.freeze(mapped);
}

function templateCode(value: unknown): string {
  const result = text(value, 'SMS_TEMPLATE_INVALID', 4, 64);
  if (!/^SMS_[A-Za-z0-9]{4,60}$/.test(result)) throw new Error('SMS_TEMPLATE_INVALID');
  return result;
}

function optOutPolicy(value: unknown): SmsConfiguration['optOut'] {
  const source = record(value, 'SMS_OPTOUT_POLICY_INVALID');
  if (Object.keys(source).sort().join(',') !== 'keywords,text,variable') throw new Error('SMS_OPTOUT_POLICY_INVALID');
  const variable = text(source.variable, 'SMS_OPTOUT_POLICY_INVALID', 2, 32);
  if (!/^[a-z][a-z0-9_]*$/.test(variable)) throw new Error('SMS_OPTOUT_POLICY_INVALID');
  const content = text(source.text, 'SMS_OPTOUT_POLICY_INVALID', 2, 32);
  if (!Array.isArray(source.keywords) || source.keywords.length < 1 || source.keywords.length > 20) throw new Error('SMS_OPTOUT_POLICY_INVALID');
  const keywords = source.keywords.map((item) => text(item, 'SMS_OPTOUT_POLICY_INVALID', 1, 16).toUpperCase());
  if (new Set(keywords).size !== keywords.length) throw new Error('SMS_OPTOUT_POLICY_INVALID');
  return Object.freeze({ variable, text: content, keywords: Object.freeze(keywords) });
}

export function parseSmsCredential(value: string): SmsCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('SMS_CREDENTIAL_INVALID');
  }
  const source = record(parsed, 'SMS_CREDENTIAL_INVALID');
  if (Object.keys(source).sort().join(',') !== 'accessKeyId,accessKeySecret') throw new Error('SMS_CREDENTIAL_INVALID');
  return Object.freeze({ accessKeyId: text(source.accessKeyId, 'SMS_CREDENTIAL_INVALID', 8, 128), accessKeySecret: text(source.accessKeySecret, 'SMS_CREDENTIAL_INVALID', 16, 256) });
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) throw new Error(code);
  return value.trim();
}
