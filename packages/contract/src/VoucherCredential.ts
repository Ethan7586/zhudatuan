/** Shared structural rules for generated/imported credentials and activation. */
export const voucherCredential = Object.freeze({
  number: Object.freeze({ minimum: 8, maximum: 40, pattern: /^[A-Za-z0-9]+$/u }),
  secret: Object.freeze({ minimum: 6, maximum: 128, pattern: /^[A-Za-z0-9!@#$%^&*]+$/u }),
});

export function voucherNumber(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return accepts(normalized, voucherCredential.number) ? normalized.toUpperCase() : null;
}

export function credentialSecret(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  // Secrets are case-sensitive ASCII. Never NFKC-normalize or case-fold them.
  return accepts(normalized, voucherCredential.secret) ? normalized : null;
}

function accepts(value: string, rule: Readonly<{ minimum: number; maximum: number; pattern: RegExp }>): boolean {
  return value.length >= rule.minimum && value.length <= rule.maximum && rule.pattern.test(value);
}
