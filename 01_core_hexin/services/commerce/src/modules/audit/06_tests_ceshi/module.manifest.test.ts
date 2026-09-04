import { describe, expect, it } from 'vitest';
import * as auditPublic from '..';
import { auditManifest } from '..';

describe('audit module manifest', () => {
  it('keeps the stable audit identity and lightweight public entry', () => {
    expect(auditManifest.id).toBe('audit');
    expect(auditManifest.publicEntry).toBe('./index.ts');
    expect(auditManifest.provides).toEqual([]);
    expect(auditPublic).toHaveProperty('AUDIT_PORT');
    expect(auditPublic).not.toHaveProperty('RecordAudit');
    expect(auditPublic).not.toHaveProperty('PgAuditRepository');
    expect(auditPublic).not.toHaveProperty('AuditModule');
    expect(auditPublic).not.toHaveProperty('auditRoutes');
    expect(auditPublic).not.toHaveProperty('AuditArchiveJobProcessor');
  });

  it('declares audit dependencies, layers, and entrypoints', () => {
    expect(auditManifest.requires).toEqual([]);
    expect(auditManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(auditManifest.entrypoints.http).toEqual(['auditRoutes']);
    expect(auditManifest.entrypoints.jobs).toEqual(['auditarchive']);
  });

  it('declares the complete audit operation inventory', () => {
    expect(auditManifest.operations).toEqual(['audit.records.read']);
  });

  it('declares audit event ownership', () => {
    expect(auditManifest.publishes).toEqual([]);
    expect(auditManifest.consumes).toEqual([]);
  });
});
