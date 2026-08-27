import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface ProviderPrice {
  readonly id: string;
  readonly book: string;
  readonly sku: string;
  readonly amountMinor: number;
  readonly compareMinor: unknown;
  readonly effectiveAt: string;
  readonly expiresAt: unknown;
}

export class PricingPort {
  async ensureProviderBook(database: OperationDatabase, id: string, scope: string, provider: string): Promise<void> {
    await database.query(`insert into pricing.pricebook(id,scope_id,currency,name,status,version) values($1,$2,'CNY',$3,'active',0)
      on conflict(scope_id,name) do update set status='active'`, [id, scope, `provider:${provider}`]);
  }

  async saveProviderPrice(database: OperationDatabase, input: ProviderPrice): Promise<void> {
    await database.query(`insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at,expires_at)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(book_id,sku_id,effective_at) do update
      set amount_minor=excluded.amount_minor,compare_minor=excluded.compare_minor,expires_at=excluded.expires_at`,
    [input.id, input.book, input.sku, input.amountMinor, input.compareMinor, input.effectiveAt, input.expiresAt]);
  }

  async saveQuote(database: OperationDatabase, input: Readonly<{ id: string; member: string; mall: string; currency: string;
    subtotalMinor: number; discountMinor: number; payableMinor: number; lines: unknown; evidenceHash: string;
    evidence: unknown; payload: unknown; signature: string; expiresAt: string }>): Promise<void> {
    await database.query(`insert into pricing.quote(id,member_id,mall_id,currency,subtotal_minor,discount_minor,payable_minor,lines,evidence_hash,
      dependencies,signed_payload,signature,expires_at,created_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11::jsonb,$12,$13,clock_timestamp())`,
    [input.id, input.member, input.mall, input.currency, input.subtotalMinor, input.discountMinor, input.payableMinor,
      JSON.stringify(input.lines), input.evidenceHash, JSON.stringify(input.evidence), JSON.stringify(input.payload), input.signature, input.expiresAt]);
  }


  async purgeQuotes(database: OperationDatabase): Promise<void> {
    await database.query(`delete from pricing.quote where expires_at<clock_timestamp()-interval '7 days'
      and not exists(select 1 from checkout.session session where session.quote_id=pricing.quote.id)`);
  }
}

export const pricingPort = new PricingPort();
