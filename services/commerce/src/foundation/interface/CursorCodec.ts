import { Cursor } from '@shop/kernel';

export interface CursorPosition {
  readonly sort: string;
  readonly id: string;
}

export class CursorCodec {
  encode(position: CursorPosition): string {
    this.validate(position);
    return Buffer.from(JSON.stringify({ version: 1, sort: position.sort, id: position.id }), 'utf8').toString('base64url');
  }

  decode(encoded: string): CursorPosition {
    Cursor.parse(encoded);
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
      if (parsed.version !== 1) throw new Error('CURSOR_VERSION_UNSUPPORTED');
      const position = { sort: parsed.sort, id: parsed.id };
      this.validate(position);
      if (this.encode(position as CursorPosition) !== encoded) throw new Error('CURSOR_NOT_CANONICAL');
      return Object.freeze(position as CursorPosition);
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'CURSOR_VERSION_UNSUPPORTED') throw cause;
      throw new Error('CURSOR_INVALID', { cause });
    }
  }

  private validate(position: Readonly<{ sort: unknown; id: unknown }>): void {
    if (typeof position.sort !== 'string' || position.sort.length === 0 || position.sort.length > 512
      || typeof position.id !== 'string' || position.id.length === 0 || position.id.length > 512) throw new Error('CURSOR_POSITION_INVALID');
  }
}
