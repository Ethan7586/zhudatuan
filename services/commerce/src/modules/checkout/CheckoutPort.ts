import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { QuoteReader, quoteDigest } from './application/QuoteReader';
import { checkoutSelection, type CheckoutQuote, type CheckoutSelection } from './domain/model/CheckoutQuote';
import { QuoteSigner } from './infrastructure/QuoteSigner';

export type { CheckoutQuote, CheckoutSelection };

export class CheckoutPort {
  private readonly reader = new QuoteReader();
  private readonly signer: QuoteSigner;

  constructor(key: string) { this.signer = new QuoteSigner(key); }

  selection(input: Readonly<Record<string, unknown>>): CheckoutSelection { return checkoutSelection(input); }
  read(database: OperationDatabase, membership: string, selection: CheckoutSelection): Promise<CheckoutQuote> {
    return this.reader.read(database, membership, selection);
  }
  sign(quote: CheckoutQuote): string { return this.signer.sign(quote); }
  verify(quote: CheckoutQuote, signature: string): boolean { return this.signer.verify(quote, signature); }
  digest(value: unknown): string { return quoteDigest(value); }
}
