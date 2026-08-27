const MOBILE_PATTERN = /^\+86(?:1[3-9]\d{9})$/;

export class Mobile {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static parse(value: string): Mobile {
    const normalized = value.replace(/[\s-]/g, '').replace(/^86/, '+86');
    if (!MOBILE_PATTERN.test(normalized)) throw new Error('MOBILE_INVALID');
    return new Mobile(normalized);
  }
}
