import { DomainError } from '../../../../platform/error/DomainError';

export type ApplicationState = 'draft' | 'active' | 'disabled';
export interface ApplicationSnapshot {
  readonly id: string;
  readonly mall: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly state: ApplicationState;
  readonly primary: boolean;
  readonly head: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class Application {
  private constructor(private readonly value: ApplicationSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(input: Omit<ApplicationSnapshot, 'state' | 'version'>): Application {
    return new Application(freeze({ ...input, state: 'draft', version: 1 }));
  }

  static restore(value: ApplicationSnapshot): Application {
    return new Application(freeze(value));
  }

  revise(input: Readonly<{ name?: string; state?: ApplicationState }>, expectedVersion: number, now: string): Application {
    this.expect(expectedVersion);
    const name = input.name?.trim() ?? this.value.name;
    const state = input.state ?? this.value.state;
    if (name === this.value.name && state === this.value.state) return this;
    return new Application(freeze({ ...this.value, name, state, version: this.value.version + 1, updatedAt: iso(now) }));
  }

  advance(head: string, expectedVersion: number, now: string): Application {
    this.expect(expectedVersion);
    if (!/^version:/.test(head) && !/:version:/.test(head)) invalid('head');
    return new Application(freeze({ ...this.value, head, version: this.value.version + 1, updatedAt: iso(now) }));
  }

  snapshot(): ApplicationSnapshot {
    return this.value;
  }

  private expect(expected: number): void {
    if (!Number.isSafeInteger(expected) || expected !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: ApplicationSnapshot): void {
  if (!/^application:/.test(value.id) || !value.mall) invalid('application');
  if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(value.code)) invalid('code');
  if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value.publicSlug)) invalid('publicSlug');
  if (value.name.trim().length < 2 || value.name.trim().length > 160) invalid('name');
  if (!['draft', 'active', 'disabled'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
  if (Date.parse(value.updatedAt) < Date.parse(value.createdAt)) invalid('updatedAt');
}
function freeze(value: ApplicationSnapshot): ApplicationSnapshot {
  return Object.freeze({ ...value, createdAt: iso(value.createdAt), updatedAt: iso(value.updatedAt) });
}
function iso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid('time');
  return parsed.toISOString();
}
function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
