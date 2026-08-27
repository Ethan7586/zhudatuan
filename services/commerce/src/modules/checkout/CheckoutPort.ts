import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { QuoteReader, quoteDigest } from './application/QuoteReader';
import { checkoutSelection, type CheckoutQuote, type CheckoutSelection } from './domain/model/CheckoutQuote';
import { QuoteSigner } from './infrastructure/QuoteSigner';

export type { CheckoutQuote, CheckoutSelection };

export class CheckoutPort {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  private readonly signer: QuoteSigner;

  constructor(key: string, private readonly reader: QuoteReader) { this.signer = new QuoteSigner(key); }
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  private readonly reader = new QuoteReader();
  private readonly signer: QuoteSigner;

  constructor(key: string) { this.signer = new QuoteSigner(key); }
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  private readonly signer: QuoteSigner;

  constructor(key: string, private readonly reader: QuoteReader) { this.signer = new QuoteSigner(key); }
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)

  selection(input: Readonly<Record<string, unknown>>): CheckoutSelection { return checkoutSelection(input); }
  read(database: OperationDatabase, membership: string, selection: CheckoutSelection): Promise<CheckoutQuote> {
    return this.reader.read(database, membership, selection);
  }
  sign(quote: CheckoutQuote): string { return this.signer.sign(quote); }
  verify(quote: CheckoutQuote, signature: string): boolean { return this.signer.verify(quote, signature); }
  digest(value: unknown): string { return quoteDigest(value); }
}
