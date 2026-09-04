import { describe, expect, it } from 'vitest';
import * as extensionPublic from '..';
import { extensionManifest } from '..';

describe('extension module manifest', () => {
  it('keeps the stable extension identity and lightweight public entry', () => {
    expect(extensionManifest.id).toBe('extension');
    expect(extensionManifest.publicEntry).toBe('./index.ts');
    expect(extensionManifest.provides).toEqual([]);
    expect(extensionPublic).toHaveProperty('EXTENSION_LOADER');
    expect(extensionPublic).not.toHaveProperty('PgExtensionRepository');
    expect(extensionPublic).not.toHaveProperty('ExtensionModule');
    expect(extensionPublic).not.toHaveProperty('extensionRoutes');
    expect(extensionPublic).not.toHaveProperty('ExtensionHealthJobProcessor');
  });

  it('declares extension dependencies, layers, and entrypoints', () => {
    expect(extensionManifest.requires).toEqual(['capability']);
    expect(extensionManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(extensionManifest.entrypoints.http).toEqual(['extensionRoutes']);
    expect(extensionManifest.entrypoints.jobs).toEqual(['extensionhealth']);
  });

  it('declares the complete extension operation inventory', () => {
    expect(extensionManifest.operations).toEqual(['extension.installations.read']);
  });

  it('declares extension event ownership', () => {
    expect(extensionManifest.publishes).toEqual([
      'extension.enabled',
      'extension.disabled',
      'extension.degraded',
    ]);
    expect(extensionManifest.consumes).toEqual([]);
  });
});
