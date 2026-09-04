import { describe, expect, it } from 'vitest';
import { Announcement } from '../domain/model/Announcement';
import { Dispatch } from '../domain/model/Dispatch';
import { Preference } from '../domain/model/Preference';
import { Template } from '../domain/model/Template';

describe('notification domain invariants', () => {
  it('rejects missing variables and freezes the exact template version', () => {
    const template = new Template('template:one', 'mall:one', 'email', 'order.paid', 4, { order: 'string' }, 'paid', '订单 {{order}}', '已支付', 'active');
    expect(() => template.select({})).toThrow('NOTIFICATION_VARIABLE_INVALID:order');
    expect(template.snapshot()).toMatchObject({ id: 'template:one', version: 4, event: 'order.paid' });
    expect(Object.isFrozen(template.snapshot())).toBe(true);
  });

  it('gives unsubscribe priority over marketing and observes overnight quiet hours', () => {
    const preference = new Preference('member:one', 'email', 'campaign.offer', false, 'accepted', 'member', { start: '22:00', end: '07:00', timezone: 'Asia/Shanghai' }, 2);
    expect(preference.allows('marketing', false, new Date('2026-09-05T04:00:00Z'))).toBe(false);
    const enabled = new Preference('member:one', 'email', 'order.paid', true, 'accepted', 'member', { start: '22:00', end: '07:00', timezone: 'Asia/Shanghai' });
    expect(enabled.allows('transactional', false, new Date('2026-09-05T15:00:00Z'))).toBe(false);
    expect(enabled.allows('transactional', true, new Date('2026-09-05T15:00:00Z'))).toBe(true);
  });

  it('requires ordered attempt evidence and an immutable deduplication key', () => {
    expect(() => new Dispatch('dispatch:one', 'mall:one', 'member:one', 'template:one', 'email', 'token', {}, '标题', '正文', 'retrying', 'event:one:email', [{
      sequence: 2, provider: 'mail', state: 'failed', errorClass: 'retryable', errorCode: 'TIMEOUT', externalId: null, attemptedAt: '2026-09-05T00:00:00Z',
    }])).toThrow('NOTIFICATION_ATTEMPT_INVALID');
  });

  it('only allows forward announcement transitions', () => {
    const value = new Announcement('announcement:one', 'mall:one', '标题', '正文', { kind: 'all' }, '2026-09-05T00:00:00Z', null, 'published', 1);
    expect(value.canTransition('retired')).toBe(true);
    expect(value.canTransition('draft')).toBe(false);
  });
});
