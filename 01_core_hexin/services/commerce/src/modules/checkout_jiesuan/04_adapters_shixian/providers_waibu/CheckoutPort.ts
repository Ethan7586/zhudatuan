import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { QuoteReader, quoteDigest } from '../../03_application_yingyong/queries_duqu/QuoteReader';
import { checkoutSelection, type CheckoutQuote, type CheckoutSelection } from '../../02_domain_yewu/models_moxing/CheckoutQuote';
import { QuoteSigner } from './QuoteSigner';

export type { CheckoutQuote, CheckoutSelection };

export class CheckoutPort {
  private readonly signer: QuoteSigner;

  constructor(key: string, private readonly reader: QuoteReader) { this.signer = new QuoteSigner(key); }

  selection(input: Readonly<Record<string, unknown>>): CheckoutSelection { return checkoutSelection(input); }
  read(database: OperationDatabase, membership: string, selection: CheckoutSelection): Promise<CheckoutQuote> {
    return this.reader.read(database, membership, selection);
  }
  sign(quote: CheckoutQuote): string { return this.signer.sign(quote); }
  verify(quote: CheckoutQuote, signature: string): boolean { return this.signer.verify(quote, signature); }
  digest(value: unknown): string { return quoteDigest(value); }
}
