import { describe, expect, it } from 'vitest';
import * as supportPublic from '..';
import { SUPPORT_CAPABILITIES, supportManifest } from '..';

describe('support module manifest', () => {
  it('keeps the stable support identity and lightweight public entry', () => {
    expect(supportManifest.id).toBe('support');
    expect(supportManifest.publicEntry).toBe('./index.ts');
    expect(supportManifest.provides).toEqual([SUPPORT_CAPABILITIES.read, SUPPORT_CAPABILITIES.manage]);
    expect(supportPublic).toHaveProperty('AssignmentPolicy');
    expect(supportPublic).toHaveProperty('Ticket');
    expect(supportPublic).toHaveProperty('Sla');
    expect(supportPublic).not.toHaveProperty('SupportModule');
    expect(supportPublic).not.toHaveProperty('supportRoutes');
    expect(supportPublic).not.toHaveProperty('PgSupportRepository');
    expect(supportPublic).not.toHaveProperty('SupportJobProcessor');
    expect(supportPublic).not.toHaveProperty('consoleSupportHealth');
    expect(supportPublic).not.toHaveProperty('openConversationOperations');
  });

  it('declares support dependencies, layers, and entrypoints', () => {
    expect(supportManifest.requires).toEqual(['order', 'member', 'benefit']);
    expect(supportManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(supportManifest.entrypoints.http).toEqual(['supportRoutes']);
    expect(supportManifest.entrypoints.jobs).toEqual(['supportsla', 'supportscan']);
  });

  it('declares the complete support operation inventory', () => {
    expect(supportManifest.operations).toEqual([
      'support.cases.create',
      'support.cases.read',
      'support.cases.update',
      'support.cases.close',
      'support.cases.reopen',
      'support.messages.send',
      'support.messages.read',
      'support.attachments.create',
      'support.assignments.manage',
      'support.agents.manage',
      'support.agents.read',
      'support.accounts.manage',
      'support.accounts.read',
      'support.rules.read',
      'support.rules.manage',
      'support.slas.read',
      'support.slas.manage',
      'support.history.read',
    ]);
  });

  it('declares support event ownership without consumers', () => {
    expect(supportManifest.publishes).toEqual([
      'support.message.sent',
      'support.ticket.assigned',
      'support.sla.escalated',
    ]);
    expect(supportManifest.consumes).toEqual([]);
  });
});
