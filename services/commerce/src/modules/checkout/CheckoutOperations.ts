import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { bodyRecord } from '../../foundation/interface/Validation';
import { domainEvent } from '../../foundation/domain/DomainEvent';
import { appendOutbox } from '../../foundation/infrastructure/OutboxStore';
import { SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import type { CheckoutPort } from './CheckoutPort';
import { fullCheckoutPort } from './FullCheckoutPort';
=======
import { CheckoutPort } from './CheckoutPort';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import type { CheckoutPort } from './CheckoutPort';
import { fullCheckoutPort } from './FullCheckoutPort';
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
import { CheckoutPort } from './CheckoutPort';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
import { pricingPort } from '../pricing/PricingModule';

export function checkoutOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  const checkout = fullCheckoutPort(context.container.get(SECURITY_KEYS).quote);
=======
  const checkout = new CheckoutPort(context.container.get(SECURITY_KEYS).quote);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const checkout = fullCheckoutPort(context.container.get(SECURITY_KEYS).quote);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  const checkout = new CheckoutPort(context.container.get(SECURITY_KEYS).quote);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  return new ModuleOperations('checkout', pool, context.container.get(AUDIT_SINK), {
    'checkout.quote.create': async (request, database) => {
      const access = requireAccess(request);
      const selection = checkout.selection(bodyRecord(request));
      const quote = await checkout.read(database, access.membership.id, selection);
      if (request.input.expectedVersion !== undefined && request.input.expectedVersion !== quote.cart.version) throw new Error('CHECKOUT_VERSION_CONFLICT:cart');
      const quoteid = `quote:${randomUUID()}`;
      const checkoutid = `checkout:${randomUUID()}`;
      const signature = checkout.sign(quote);
      const evidenceHash = checkout.digest(quote.evidence);
      const expires = new Date(Date.now() + 15 * 60_000).toISOString();
      await pricingPort.saveQuote(database, { id: quoteid, member: quote.cart.member, mall: quote.cart.mall, currency: quote.currency,
        subtotalMinor: quote.subtotalMinor, discountMinor: quote.discountMinor, payableMinor: quote.payableMinor, lines: quote.lines,
        evidenceHash, evidence: quote.evidence, payload: quote, signature, expiresAt: expires });
      const created = await database.query(`insert into checkout.session(id,cart_id,member_id,mall_id,application_id,quote_id,quote_hash,address_id,
        input,state,expires_at,created_at,version) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'quoted',$10,clock_timestamp(),0)
        returning id,quote_id,quote_hash,state,expires_at,version`, [checkoutid, quote.cart.id, quote.cart.member, quote.cart.mall, quote.cart.application,
        quoteid, signature, selection.address, JSON.stringify(selection), expires]);
      await saveEvidence(database, checkoutid, quote.evidence, expires, checkout);
      await appendOutbox(database, domainEvent({ event: `event:${randomUUID()}`, type: 'checkout.quote.created', version: 1,
        aggregate: { type: 'checkout', id: checkoutid }, tenant: quote.cart.mall, occurred: new Date().toISOString(), trace: access.trace,
        payload: { checkout: checkoutid, quote: quoteid, member: quote.cart.member, mall: quote.cart.mall, payableMinor: quote.payableMinor,
          personalMinor: quote.personalMinor, currency: quote.currency, expiresAt: expires, evidenceHash } }));
      return { status: 201, body: { ...created.rows[0], quote: { id: quoteid, subtotalMinor: quote.subtotalMinor,
        discountMinor: quote.discountMinor, payableMinor: quote.payableMinor, personalMinor: quote.personalMinor, currency: quote.currency,
        lines: quote.lines, tenders: quote.tenders, rejections: quote.rejections } }, headers: { etag: '"0"' } };
    },
  });
}

async function saveEvidence(database: { query(text: string, values?: readonly unknown[]): Promise<unknown> }, checkoutid: string,
    evidence: Readonly<Record<string, unknown>>, expires: string, checkout: CheckoutPort): Promise<void> {
  for (const [kind, value] of Object.entries(evidence).sort(([left], [right]) => left.localeCompare(right))) {
    const records = Array.isArray(value) ? value : value === null ? [] : [value];
    for (let index = 0; index < records.length; index += 1) {
      const payload = records[index];
      const record = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
      const reference = typeof record.id === 'string' ? record.id : `${checkoutid}:${kind}:${index}`;
      const version = String(record.version ?? record.hash ?? '1');
      await database.query(`insert into checkout.evidence(checkout_id,kind,reference_id,version,payload_hash,expires_at)
        values($1,$2,$3,$4,$5,$6)`, [checkoutid, kind, reference, version, checkout.digest(payload), expires]);
    }
  }
}
