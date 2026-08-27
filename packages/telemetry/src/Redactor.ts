<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
const SENSITIVE_KEY = /(authorization|cookie|token|proof|secret|password|credential|cardcode|address|mobile|phone|email|privatekey|apikey|csrf|nonce|challenge|callback|invite)/i;
=======
const SENSITIVE_KEY = /(authorization|cookie|token|secret|password|credential|cardcode|address|mobile|phone|email|privatekey|apikey|csrf|nonce|challenge|callback|invite)/i;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const SENSITIVE_KEY = /(authorization|cookie|token|proof|secret|password|credential|cardcode|address|mobile|phone|email|privatekey|apikey|csrf|nonce|challenge|callback|invite)/i;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
const SENSITIVE_KEY = /(authorization|cookie|token|secret|password|credential|cardcode|address|mobile|phone|email|privatekey|apikey|csrf|nonce|challenge|callback|invite)/i;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const MOBILE = /(?:\+?86)?1[3-9]\d{9}/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export class Redactor {
  redact(value: unknown, key = ''): unknown {
    if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
    if (typeof value === 'string') return value.replace(BEARER, 'Bearer [REDACTED]').replace(MOBILE, '[MOBILE]').replace(EMAIL, '[EMAIL]');
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, this.redact(child, childKey)]));
    }
    return value;
  }
}
