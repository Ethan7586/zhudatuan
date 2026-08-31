import type { Quote } from '../model/Quote';
import { nullableText } from '../../../shared/format/Text';

type Value = Readonly<Record<string, unknown>>;

export function mapQuote(value: Value): Quote {
  return Object.freeze({
    checkoutId: String(value.checkoutId),
    quoteId: String(value.quoteId),
    quoteVersion: Number(value.quoteVersion),
    signature: String(value.signature),
    expiresAt: String(value.expiresAt),
    cartVersion: Number(value.cartVersion),
    lines: Object.freeze(
      (value.lines as readonly Value[]).map((line) =>
        Object.freeze({
          listing: String(line.listing),
          quantity: Number(line.quantity),
          payableMinor: Number(line.payableMinor),
          accepted: Boolean(line.accepted),
          reasons: Object.freeze(line.reasons as readonly string[]),
          versions: Object.freeze(line.versions as Record<string, string | number>),
        })
      )
    ),
    subtotalMinor: Number(value.subtotalMinor),
    discountMinor: Number(value.discountMinor),
    shippingMinor: Number(value.shippingMinor),
    payableMinor: Number(value.payableMinor),
    benefitMinor: Number(value.benefitMinor),
    personalMinor: Number(value.personalMinor),
    currency: String(value.currency),
    tenders: Object.freeze((value.tenders as readonly Value[]).map((tender) => Object.freeze({ kind: tender.kind as 'benefit' | 'voucher' | 'wechat', reference: nullableText(tender.reference), amountMinor: Number(tender.amountMinor) }))),
    rejections: Object.freeze((value.rejections as readonly Value[]).map((item) => Object.freeze({ listing: String(item.listing), reasons: Object.freeze(item.reasons as readonly string[]) }))),
  });
}
