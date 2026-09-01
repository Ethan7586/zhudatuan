import { describe, expect, it } from 'vitest';
import { Money } from '@shop/kernel';
import { CheckoutPolicy } from '../../modules/checkout/domain/policy/CheckoutPolicy';
import { PublishPolicy } from '../../modules/experience/domain/policy/PublishPolicy';
import { PostingPolicy } from '../../modules/finance/domain/policy/PostingPolicy';
import { PasswordPolicy } from '../../modules/identity/domain/policy/PasswordPolicy';
import { available, Reservation } from '../../modules/inventory/domain/model/Reservation';
import { Order } from '../../modules/order/domain/model/Order';
import { AllocationPolicy } from '../../modules/payment/domain/policy/AllocationPolicy';
import { RiskPolicy } from '../../modules/risk/domain/model/RiskPolicy';
import { RiskEngine } from '../../modules/risk/domain/policy/RiskEngine';
import { AssignmentPolicy } from '../../modules/support/domain/policy/AssignmentPolicy';
import { AssignmentRule } from '../../modules/support/domain/model/AssignmentRule';
import { Ticket } from '../../modules/support/domain/model/Ticket';
import { Template } from '../../modules/notification/domain/model/Template';
import { Announcement } from '../../modules/notification/domain/model/Announcement';
import { Preference } from '../../modules/notification/domain/model/Preference';
import { VoucherPolicy } from '../../modules/voucher/domain/policy/VoucherPolicy';

describe('high-risk domain invariants', () => {
  it('rejects stale checkout evidence and invalid publication evidence', () => {
    expect(() => new CheckoutPolicy().assertVersions({ price: 2, stock: 4 }, { price: 2, stock: 3 })).toThrow('CHECKOUT_VERSION_CONFLICT:stock');
    expect(() => new PublishPolicy().assertPublishable({ schema: true, assets: true, actions: false, capabilities: true, bindings: true, preview: true })).toThrow('EXPERIENCE_PUBLICATION_INVALID');
  });

  it('preserves finance balance and original-tender refund limits', () => {
    const cny = (minor: number) => Money.of(minor, 'CNY');
    expect(() =>
      new PostingPolicy().assertBalanced([
        { side: 'debit', amount: cny(100) },
        { side: 'credit', amount: cny(99) },
      ])
    ).toThrow('FINANCE_JOURNAL_UNBALANCED');
    expect(
      new AllocationPolicy()
        .allocateRefund(
          [
            { tender: 'benefit', amount: cny(80), refundable: cny(50) },
            { tender: 'wechat', amount: cny(20), refundable: cny(20) },
          ],
          cny(60)
        )
        .map(({ tender, amount }) => [tender, amount.minor])
    ).toEqual([
      ['wechat', 20],
      ['benefit', 40],
    ]);
    expect(() => new AllocationPolicy().allocateRefund([{ tender: 'wechat', amount: cny(20), refundable: cny(20) }], cny(21))).toThrow('PAYMENT_REFUND_EXCEEDS_AVAILABLE');
  });

  it('keeps inventory, order and voucher state machines final', () => {
    expect(available(10, 4, 2)).toBe(4);
    const reservation = new Reservation('reservation', 1);
    reservation.commit();
    expect(() => reservation.release()).toThrow('INVENTORY_RESERVATION_FINAL');
    expect(() => new Order('order', 'cancelled', 'paid', 'shipped', 'none').assertCancellable()).toThrow('ORDER_NOT_CANCELLABLE');
    expect(() => new VoucherPolicy().assertTransition('redeemed', 'active')).toThrow('VOUCHER_STATE_INVALID');
  });

  it('uses deterministic risk precedence and least-loaded support assignment', () => {
    const engine = new RiskEngine();
    const decision = (rule: unknown, actor: string, operation: string) => engine.evaluate(new RiskPolicy('policy', 1, rule, 100).rule, { actor, operation, amountMinor: null, velocity: 0, blocked: false, signals: [] }).outcome;
    expect(decision({ blockedActors: ['actor'], challengeOperations: ['payment'] }, 'actor', 'payment')).toBe('deny');
    expect(decision({ reviewOperations: ['refund'], challengeOperations: ['refund'] }, 'other', 'refund')).toBe('review');
    const selected = new AssignmentPolicy().decide({
      agents: [
        { id: 'b', online: true, load: 1, skills: ['order'], scopes: ['mall'] },
        { id: 'a', online: true, load: 1, skills: ['order'], scopes: ['mall'] },
      ],
      scope: 'mall',
      skill: 'order',
    });
    expect(selected?.id).toBe('a');
    const rules = [new AssignmentRule('rule', 'mall', 'order', ['urgent'], 100, true)];
    expect(new AssignmentPolicy().decide({ agents: [{ id: 'a', online: true, load: 0, skills: ['order'], scopes: ['mall'] }], rules, scope: 'mall', skill: 'order', priority: 'normal' })).toBeNull();
    const ticket = new Ticket('ticket', 'conversation', 'mall', 'urgent', 'resolved', 1);
    ticket.requireTransition('closed');
    expect(() => ticket.requireTransition('assigned')).toThrow('SUPPORT_TICKET_TRANSITION_INVALID');
  });

  it('validates notification schemas, redacts undeclared event data and enforces explicit subscription consent', () => {
    const template = new Template('template', 'mall', 'inapp', 'order.paid', 1, { order: 'string', amount: 'number' }, null, '订单 {{order}}', '已支付 {{amount}} 分', 'active');
    expect(template.select({ order: 'O1', amount: 100, mobile: '13800000000' })).toEqual({ order: 'O1', amount: 100 });
    expect(template.render(template.body, template.select({ order: 'O1', amount: 100 }))).toBe('已支付 100 分');
    expect(() => new Template('template', 'mall', 'sms', 'order.paid', 1, {}, null, null, '正文', 'active')).toThrow('NOTIFICATION_PROVIDER_TEMPLATE_REQUIRED');
    expect(() => new Preference('member', 'wechat', 'order.paid', true, 'rejected')).toThrow('NOTIFICATION_SUBSCRIPTION_REJECTED');
    expect(new Announcement('announcement', 'mall', '公告', '正文', { kind: 'members', members: ['member'] }, '2026-08-21T00:00:00Z', '2026-08-22T00:00:00Z', 'published', 0).audience.kind).toBe('members');
  });

  it('hashes passwords with a versioned strong KDF and constant-work missing-user verification', async () => {
    const policy = new PasswordPolicy();
    const encoded = await policy.hash('Strong-Password-2026');
    expect(encoded).toMatch(/^scrypt\$v1\$32768\$8\$1\$/);
    await expect(policy.verify('Strong-Password-2026', encoded)).resolves.toBe(true);
    await expect(policy.verify('Wrong-Password-2026', encoded)).resolves.toBe(false);
    await expect(policy.verify('Any-Password-2026', null)).resolves.toBe(false);
  });
});
