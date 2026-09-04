const SECRET = /(?:password|passwd|secret|token|cookie|authorization|otp|verificationcode|ciphertext|cardnumber|cardcode|privatekey)/i;
const PHONE = /(?:phone|mobile)/i;
const EMAIL = /email/i;
const ADDRESS = /address/i;
const SECRET_VALUE = /^(?:bearer|basic)\s+\S+|^-----BEGIN [A-Z ]+PRIVATE KEY-----|^[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$|(?:password|passwd|secret|token)=([^&\s]{4,})/i;

export class RedactionPolicy {
  redact(value: unknown): unknown {
    return redact(value, '', 0);
  }
}

function redact(value: unknown, key: string, depth: number): unknown {
  if (SECRET.test(key)) return '[REDACTED]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return minimize(key, value);
  if (depth >= 6) return '[DEPTH_LIMIT]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redact(item, key, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, 500);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 100)
      .map(([name, item]) => [name, redact(item, name, depth + 1)])
  );
}

function minimize(key: string, value: string): string {
  if (SECRET_VALUE.test(value)) return '[REDACTED]';
  if (PHONE.test(key)) return value.length > 4 ? `${value.slice(0, 2)}***${value.slice(-2)}` : '***';
  if (EMAIL.test(key)) {
    const separator = value.lastIndexOf('@');
    return separator > 0 ? `***${value.slice(separator)}` : '***';
  }
  if (ADDRESS.test(key)) return '[MINIMIZED]';
  return value.slice(0, 500);
}
