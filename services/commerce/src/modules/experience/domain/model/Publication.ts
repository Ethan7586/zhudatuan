import { DomainError } from '../../../../foundation/domain/DomainError';

export type PublicationState = 'staged' | 'active' | 'retired' | 'failed';
export interface PublicationSnapshot {
  readonly id: string;
  readonly release: string;
  readonly application: string;
  readonly version: string;
  readonly contentHash: string;
  readonly objectKey: string;
  readonly objectRef: string;
  readonly objectHash: string;
  readonly objectSize: number;
  readonly state: PublicationState;
  readonly stagedAt: string;
  readonly publishedAt: string | null;
  readonly failureCode: string | null;
}

export class Publication {
  private constructor(private readonly value: PublicationSnapshot) {
    validate(value);
    Object.freeze(this);
  }
  static stage(input: Omit<PublicationSnapshot, 'state' | 'publishedAt' | 'failureCode'>): Publication {
    return new Publication(Object.freeze({ ...input, state: 'staged', publishedAt: null, failureCode: null }));
  }
  static restore(value: PublicationSnapshot): Publication {
    return new Publication(Object.freeze({ ...value }));
  }
  activate(at: string): Publication {
    if (this.value.state === 'active') return this;
    if (!['staged', 'failed'].includes(this.value.state)) invalid('transition');
    return new Publication(Object.freeze({ ...this.value, state: 'active', publishedAt: iso(at), failureCode: null }));
  }
  retire(): Publication {
    if (this.value.state === 'retired') return this;
    if (this.value.state !== 'active') invalid('transition');
    return new Publication(Object.freeze({ ...this.value, state: 'retired', failureCode: null }));
  }
  fail(code: string): Publication {
    if (!['staged', 'failed'].includes(this.value.state) || !/^[A-Z][A-Z0-9_]{2,127}$/.test(code)) invalid('failure');
    return new Publication(Object.freeze({ ...this.value, state: 'failed', publishedAt: null, failureCode: code }));
  }
  snapshot(): PublicationSnapshot {
    return this.value;
  }
}
function validate(value: PublicationSnapshot): void {
  if (!/^publication:/.test(value.id) || !/^[0-9a-f]{64}$/.test(value.contentHash) || value.objectHash !== value.contentHash || !Number.isSafeInteger(value.objectSize) || value.objectSize < 1) invalid('publication');
  if (value.state === 'staged' && (value.publishedAt !== null || value.failureCode !== null)) invalid('state');
  if (value.state === 'active' && (value.publishedAt === null || value.failureCode !== null)) invalid('state');
  if (value.state === 'retired' && (value.publishedAt === null || value.failureCode !== null)) invalid('state');
  if (value.state === 'failed' && (value.publishedAt !== null || value.failureCode === null)) invalid('state');
}
function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid('time');
  return parsed.toISOString();
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
