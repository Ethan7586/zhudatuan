import { createHmac } from 'node:crypto';

export interface NavigationKeyValue {
  readonly cache: string;
  readonly indexes: readonly string[];
}

export class NavigationKey implements NavigationKeyValue {
  readonly cache: string;
  readonly indexes: readonly string[];

  constructor(secret: string, input: Readonly<{ catalog: string; target: string; principal: string; membership: string; scope: string; accessVersion: number; capabilityVersion: number; featureVersion: string }>) {
    if (secret.length < 32) throw new Error('NAVIGATION_KEY_SECRET_INVALID');
    const digest = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
    const canonical = [input.catalog, input.target, input.principal, input.membership, input.scope, input.accessVersion, input.capabilityVersion, input.featureVersion].join('\u001f');
    this.cache = `navigation:v2:${digest(canonical)}`;
    this.indexes = Object.freeze([
      NavigationKey.global(secret),
      NavigationKey.index(secret, 'catalog', input.catalog),
      NavigationKey.index(secret, 'target', input.target),
      `navigation:index:principal:${digest(`principal:${input.principal}`)}`,
      `navigation:index:membership:${digest(`membership:${input.membership}`)}`,
      `navigation:index:scope:${digest(`scope:${input.scope}`)}`,
      `navigation:index:version:${digest(`version:${input.accessVersion}:${input.capabilityVersion}`)}`,
    ]);
    Object.freeze(this);
  }

  static index(secret: string, type: 'catalog' | 'target' | 'principal' | 'membership' | 'scope', value: string): string {
    if (secret.length < 32 || !value) throw new Error('NAVIGATION_INDEX_INVALID');
    return `navigation:index:${type}:${createHmac('sha256', secret).update(`${type}:${value}`).digest('hex')}`;
  }

  static pointer(secret: string, input: Readonly<{ catalog: string; target: string; principal: string; membership: string; scope: string; accessVersion: number; capabilityVersion: number; featureVersion: string }>): string {
    if (secret.length < 32) throw new Error('NAVIGATION_KEY_SECRET_INVALID');
    return `navigation:pointer:v2:${createHmac('sha256', secret).update([input.catalog, input.target, input.principal, input.membership, input.scope, input.accessVersion, input.capabilityVersion, input.featureVersion].join('\u001f')).digest('hex')}`;
  }

  static global(secret: string): string {
    if (secret.length < 32) throw new Error('NAVIGATION_KEY_SECRET_INVALID');
    return `navigation:index:global:${createHmac('sha256', secret).update('global').digest('hex')}`;
  }
}
