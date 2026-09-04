import { describe, expect, it } from 'vitest';
import { MessagePolicy } from './MessagePolicy';

const policy = new MessagePolicy();

describe('MessagePolicy', () => {
  it('normalizes text and attachment-only content through one classification policy', () => {
    expect(policy.prepare({ body: '  已受理  ', clientMessageId: 'client:0001', attachmentIds: [], author: 'agent' })).toMatchObject({ body: '已受理', kind: 'text', visibility: 'external' });
    expect(policy.prepare({ body: '', clientMessageId: 'client:0002', attachmentIds: ['evidence:one'], author: 'member' })).toMatchObject({ body: '', kind: 'attachment', visibility: 'external' });
  });

  it('keeps system content internal and rejects member-only visibility escalation', () => {
    expect(policy.prepare({ body: '自动分配失败', clientMessageId: 'system:0001', attachmentIds: [], author: 'system' })).toMatchObject({ kind: 'system', visibility: 'internal' });
    expect(() => policy.prepare({ body: '隐藏消息', clientMessageId: 'client:0003', attachmentIds: [], author: 'member', visibility: 'internal' })).toThrow('SUPPORT_MESSAGE_VISIBILITY_DENIED');
  });

  it('centralizes clean attachment evidence decisions', () => {
    expect(() => policy.assertAttachments(['evidence:one'], [{ id: 'evidence:one', state: 'pending' }])).toThrow('SUPPORT_ATTACHMENT_NOT_READY');
    expect(() => policy.assertAttachments(['evidence:one'], [{ id: 'evidence:one', state: 'rejected' }])).toThrow('SUPPORT_ATTACHMENT_REJECTED');
    expect(() => policy.assertAttachments(['evidence:one'], [{ id: 'evidence:one', state: 'clean' }])).not.toThrow();
  });
});
