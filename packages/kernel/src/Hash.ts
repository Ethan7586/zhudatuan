const HASH_PATTERN = /^[a-f0-9]{64}$/;

export class Hash {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static sha256(value: string): Hash {
    const normalized = value.toLowerCase();
    if (!HASH_PATTERN.test(normalized)) throw new Error('HASH_INVALID');
    return new Hash(normalized);
  }
}
