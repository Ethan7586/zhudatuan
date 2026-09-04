import { describe, expect, it } from 'vitest';
import * as experiencePublic from '..';
import { experienceManifest } from '..';

describe('experience module manifest', () => {
  it('keeps the stable experience identity and lightweight public entry', () => {
    expect(experienceManifest.id).toBe('experience');
    expect(experienceManifest.publicEntry).toBe('./index.ts');
    expect(experienceManifest.provides).toEqual([]);
    expect(experiencePublic).toHaveProperty('ExperienceProvisioningPort');
    expect(experiencePublic).toHaveProperty('experienceProvisioningPort');
    expect(experiencePublic).toHaveProperty('PublishPolicy');
    expect(experiencePublic).not.toHaveProperty('ExperienceModule');
    expect(experiencePublic).not.toHaveProperty('IdentityOperatorExperienceModule');
    expect(experiencePublic).not.toHaveProperty('experienceOperations');
    expect(experiencePublic).not.toHaveProperty('experienceOperatorOperations');
    expect(experiencePublic).not.toHaveProperty('ExperienceJobProcessor');
    expect(experiencePublic).not.toHaveProperty('CdnPublisher');
  });

  it('declares experience dependencies, layers, and entrypoints', () => {
    expect(experienceManifest.requires).toEqual(['catalog']);
    expect(experienceManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(experienceManifest.entrypoints.http).toEqual(['experienceOperations', 'experienceOperatorOperations']);
    expect(experienceManifest.entrypoints.jobs).toEqual(['experiencepublish']);
  });

  it('declares the complete experience operation inventory', () => {
    expect(experienceManifest.operations).toEqual([
      'experience.published.read',
      'experience.applications.create',
      'experience.applications.copy',
      'experience.applications.read',
      'experience.applications.update',
      'experience.versions.save',
      'experience.versions.validate',
      'experience.versions.publish',
      'experience.versions.restore',
    ]);
  });

  it('declares experience event ownership', () => {
    expect(experienceManifest.publishes).toEqual(['experience.published']);
    expect(experienceManifest.consumes).toEqual([]);
  });
});
