const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static parse(value: string): Email {
    const normalized = value.trim().toLowerCase();
    if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) throw new Error('EMAIL_INVALID');
    return new Email(normalized);
  }
}
