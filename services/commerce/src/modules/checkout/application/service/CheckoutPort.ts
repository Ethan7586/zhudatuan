import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { QuoteReader, quoteDigest } from './QuoteReader';
import type { CheckoutQuote } from '../../domain/model/CheckoutQuote';
import { checkoutSelection, type CheckoutSelection } from '../../domain/model/CheckoutSelection';
import { QuoteSigner } from '../../domain/service/QuoteSigner';
import { storedQuote } from '../../domain/model/StoredQuote';
import type { QuoteControl } from './QuoteDependencyCall';

export type { CheckoutQuote, CheckoutSelection };

export class CheckoutPort {
  private readonly signer: QuoteSigner;

  constructor(
    key: string,
    private readonly reader: QuoteReader
  ) {
    this.signer = new QuoteSigner(key);
  }

  selection(input: Readonly<Record<string, unknown>>): CheckoutSelection {
    return checkoutSelection(input);
  }
  read(transaction: ReadTransactionContext, membership: string, selection: CheckoutSelection, context: QuoteControl): Promise<CheckoutQuote> {
    return this.reader.read(transaction, membership, selection, context);
  }
  sign(quote: CheckoutQuote): string {
    return this.signer.sign(quote);
  }
  verify(quote: CheckoutQuote, signature: string): boolean {
    return this.signer.verify(quote, signature);
  }
  restore(value: unknown, signature: string): CheckoutQuote {
    if (!this.signer.verify(value, signature)) throw new Error('QUOTE_SIGNATURE_INVALID');
    return storedQuote(value);
  }
  digest(value: unknown): string {
    return quoteDigest(value);
  }
}
