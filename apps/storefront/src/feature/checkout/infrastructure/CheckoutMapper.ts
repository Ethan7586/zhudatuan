import type { Quote } from '../model/Quote';
import { nullableText } from '../../../shared/format/Text';

type Value = Readonly<Record<string, unknown>>;

export function mapQuote(value: Value): Quote {
  return Object.freeze({
    checkoutId: String(value.checkoutId),
    quoteId: String(value.quoteId),
    quoteVersion: Number(value.quoteVersion),
    confirmationToken: nullableText(value.confirmationToken),
    evidenceHash: String(value.evidenceHash),
    expiresAt: String(value.expiresAt),
    selection: mapSelection(value.selection as Value),
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
    taxMinor: Number(value.taxMinor),
    payableMinor: Number(value.payableMinor),
    benefitMinor: Number(value.benefitMinor),
    personalMinor: Number(value.personalMinor),
    currency: String(value.currency),
    tenders: Object.freeze((value.tenders as readonly Value[]).map((tender) => Object.freeze({ kind: tender.kind as Quote['tenders'][number]['kind'], reference: nullableText(tender.reference), amountMinor: Number(tender.amountMinor) }))),
    rejections: Object.freeze((value.rejections as readonly Value[]).map((item) => Object.freeze({ listing: String(item.listing), reasons: Object.freeze(item.reasons as readonly string[]) }))),
  });
}

function mapSelection(value: Value): Quote['selection'] {
  const delivery = value.delivery as Value;
  return Object.freeze({
    cartVersion: Number(value.cartVersion),
    lines: Object.freeze((value.lines as readonly Value[]).map((line) => Object.freeze({ listingId: String(line.listingId), quantity: Number(line.quantity), lineVersion: Number(line.lineVersion) }))),
    addressId: nullableText(value.addressId),
    invoiceId: nullableText(value.invoiceId),
    delivery: Object.freeze({ method: delivery.method as Quote['selection']['delivery']['method'], note: nullableText(delivery.note), scheduledAt: nullableText(delivery.scheduledAt) }),
    voucherIds: Object.freeze((value.voucherIds as readonly unknown[]).map(String)),
    benefits: Object.freeze((value.benefits as readonly Value[]).map((benefit) => Object.freeze({ accountId: String(benefit.accountId), amountMinor: Number(benefit.amountMinor) }))),
    paymentScene: value.paymentScene as Quote['selection']['paymentScene'],
  });
}
