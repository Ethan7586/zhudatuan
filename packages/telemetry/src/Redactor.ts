const SENSITIVE_KEY = /(authorization|cookie|token|tokenhash|secret|password|credential|cardcode|code|address|mobile|phone|email|recipient|privatekey|apikey|csrf|nonce|challenge|callback|invite|claim|preauth)/i;
const OPERATIONAL_CODE_KEY = /^(errorCode|faultCode)$/;
const OPERATIONAL_CODE = /^[A-Z][A-Z0-9]*(?:[._:-][A-Z0-9]+)*$/;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const MOBILE = /(?:\+?86)?1[3-9]\d{9}/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export class Redactor {
  redact(value: unknown, key = ''): unknown {
    if (OPERATIONAL_CODE_KEY.test(key) && typeof value === 'string' && OPERATIONAL_CODE.test(value)) return value;
    if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
    if (typeof value === 'string') return value.replace(BEARER, 'Bearer [REDACTED]').replace(MOBILE, '[MOBILE]').replace(EMAIL, '[EMAIL]');
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, this.redact(child, childKey)]));
    }
    return value;
  }
}
