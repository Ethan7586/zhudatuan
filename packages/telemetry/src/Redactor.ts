import { REDACTION_KEY_PATTERN } from './RedactionCatalog';

const OPERATIONAL_CODE_KEY = /^(errorCode|faultCode)$/;
const OPERATIONAL_CODE = /^[A-Z][A-Z0-9]*(?:[._:-][A-Z0-9]+)*$/;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const MOBILE = /(?:\+?86)?1[3-9]\d{9}/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export class Redactor {
  redact(value: unknown, key = ''): unknown {
    return this.visit(value, key, '', new Set());
  }

  redactPaths(value: unknown, paths: readonly string[]): unknown {
    return this.visit(value, '', '', new Set(paths));
  }

  private visit(value: unknown, key: string, path: string, paths: ReadonlySet<string>): unknown {
    if (paths.has(path)) return '[REDACTED]';
    if (OPERATIONAL_CODE_KEY.test(key) && typeof value === 'string' && OPERATIONAL_CODE.test(value)) return value;
    if (REDACTION_KEY_PATTERN.test(key)) return '[REDACTED]';
    if (typeof value === 'string') return value.replace(BEARER, 'Bearer [REDACTED]').replace(MOBILE, '[MOBILE]').replace(EMAIL, '[EMAIL]');
    if (Array.isArray(value)) return value.map((item) => this.visit(item, '', path, paths));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, this.visit(child, childKey, path ? `${path}.${childKey}` : childKey, paths)]));
    }
    return value;
  }
}
