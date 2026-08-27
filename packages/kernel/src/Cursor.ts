const CURSOR_PATTERN = /^[A-Za-z0-9_-]{24,1024}$/;

export class Cursor {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  static parse(value: string): Cursor {
    if (!CURSOR_PATTERN.test(value)) throw new Error('CURSOR_INVALID');
    return new Cursor(value);
  }
}
