import { createHmac } from 'node:crypto';

export interface NavigationKeyValue {
  readonly cache: string;
  readonly indexes: readonly string[];
}

export class NavigationKey implements NavigationKeyValue {
  readonly cache: string;
  readonly indexes: readonly string[];

  constructor(secret: string, input: Readonly<{ catalog: string; target: string; principal: string; membership: string; scope: string; accessVersion: number; capabilityVersion: number }>) {
    if (secret.length < 32) throw new Error('NAVIGATION_KEY_SECRET_INVALID');
    const digest = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
    const canonical = [input.catalog, input.target, input.principal, input.membership, input.scope, input.accessVersion, input.capabilityVersion].join('\u001f');
    this.cache = `navigation:v1:${digest(canonical)}`;
    this.indexes = Object.freeze([
      `navigation:index:principal:${digest(`principal:${input.principal}`)}`,
      `navigation:index:membership:${digest(`membership:${input.membership}`)}`,
      `navigation:index:scope:${digest(`scope:${input.scope}`)}`,
      `navigation:index:version:${digest(`version:${input.accessVersion}:${input.capabilityVersion}`)}`,
    ]);
    Object.freeze(this);
  }

  static index(secret: string, type: 'principal' | 'membership' | 'scope', value: string): string {
    if (secret.length < 32 || !value) throw new Error('NAVIGATION_INDEX_INVALID');
    return `navigation:index:${type}:${createHmac('sha256', secret).update(`${type}:${value}`).digest('hex')}`;
  }

  static pointer(secret: string, input: Readonly<{ catalog: string; target: string; principal: string; membership: string; scope: string; accessVersion: number; capabilityVersion: number }>): string {
    if (secret.length < 32) throw new Error('NAVIGATION_KEY_SECRET_INVALID');
    return `navigation:pointer:${createHmac('sha256', secret).update([input.catalog, input.target, input.principal, input.membership, input.scope, input.accessVersion, input.capabilityVersion].join('\u001f')).digest('hex')}`;
  }
}
