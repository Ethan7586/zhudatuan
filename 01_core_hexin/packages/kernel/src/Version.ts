export class Version {
  private constructor(readonly value: number) {
    Object.freeze(this);
  }

  static of(value: number): Version {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('VERSION_INVALID');
    return new Version(value);
  }

  next(): Version {
    return Version.of(this.value + 1);
  }
}
