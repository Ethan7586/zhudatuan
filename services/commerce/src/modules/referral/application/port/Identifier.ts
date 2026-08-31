import { randomUUID } from 'node:crypto';

export interface Identifier {
  next(kind: string): string;
}

export const UuidIdentifier: Identifier = Object.freeze({ next: (kind: string) => `${kind}:${randomUUID()}` });
