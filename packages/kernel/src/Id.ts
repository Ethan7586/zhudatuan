const ID_PATTERN = /^[a-z][a-z0-9]{1,31}_[0-9A-HJKMNP-TV-Z]{26}$/;

export class Id {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static parse(value: string): Id {
    if (!ID_PATTERN.test(value)) throw new Error('ID_INVALID');
    return new Id(value);
  }

  toString(): string {
    return this.value;
  }
}
