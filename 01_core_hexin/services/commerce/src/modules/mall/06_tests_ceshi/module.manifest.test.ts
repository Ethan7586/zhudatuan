import { describe, expect, it } from 'vitest';
import { mallManifest } from '../module.manifest';

describe('mall module manifest', () => {
  it('keeps the stable mall identity and public entry', () => {
    expect(mallManifest.id).toBe('mall');
    expect(mallManifest.publicEntry).toBe('./index.ts');
  });

  it('declares the implemented module boundaries', () => {
    expect(mallManifest.layers).toEqual(['domain', 'tests']);
    expect(mallManifest.provides).toEqual([]);
    expect(mallManifest.operations).toEqual([]);
  });
});
