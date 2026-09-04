import { APPROVAL_SUBJECT_KINDS, PROVIDER_UI_CATALOGS, RUNTIME_IMPORT_OWNERS } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { createRegistry } from './Registry';
import { consoleRegistries } from './Registries';

describe('console registries', () => {
  it('exposes every generated approval subject exactly once with one Chinese label', () => {
    const entries = consoleRegistries.approval.all();

    expect(entries.map(({ id }) => id)).toEqual(APPROVAL_SUBJECT_KINDS);
    expect(new Set(entries.map(({ label }) => label)).size).toBe(entries.length);
    expect(entries.every(({ label }) => /[\u3400-\u9fff]/u.test(label))).toBe(true);
  });

  it('binds every generated import owner to one unique write operation and immutable template', () => {
    const entries = consoleRegistries.imports.all();

    expect(entries.map(({ id }) => id)).toEqual(RUNTIME_IMPORT_OWNERS);
    expect(new Set(entries.map(({ operation }) => operation)).size).toBe(entries.length);
    expect(entries.every(({ columns }) => columns.length > 0 && Object.isFrozen(columns))).toBe(true);
  });

  it('projects every Console-capable generated extension without a private provider list', () => {
    const expected = PROVIDER_UI_CATALOGS.filter(({ clients }) => clients.includes('console'));
    const entries = consoleRegistries.extensions.all();

    expect(entries.map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    expect(entries.every(({ capabilities }) => capabilities.length > 0 && Object.isFrozen(capabilities))).toBe(true);
  });

  it('fails fast for duplicate, missing and unknown registrations', () => {
    expect(() => createRegistry<string, { readonly id: string }>([{ id: 'one' }, { id: 'one' }], ['one'], 'TEST')).toThrow('TEST_REGISTRY_DUPLICATE:one');
    expect(() => createRegistry<string, { readonly id: string }>([{ id: 'one' }], ['one', 'two'], 'TEST')).toThrow('TEST_REGISTRY_MISSING:two');
    expect(() => createRegistry<string, { readonly id: string }>([{ id: 'one' }, { id: 'two' }], ['one'], 'TEST')).toThrow('TEST_REGISTRY_UNKNOWN');
  });
});
