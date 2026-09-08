import { array, boolean, int, literal, maxLength, maximum, minLength, minimum, null as nullSchema, number, optional, record, strictObject, string, union } from 'zod/mini';
import { ContractJsonValueSchema } from './JsonSchema';
import { currency, id, isoUtc, unsigned, version } from './Primitives';

const positive = number().check(int(), minimum(1), maximum(Number.MAX_SAFE_INTEGER));
const selectedLine = strictObject({ listingId: id<'listing'>(), quantity: positive, lineVersion: version });
const benefitChoice = strictObject({ accountId: id<'benefitaccount'>(), amountMinor: positive });
const deliveryChoice = strictObject({
  method: literal(['standard', 'express', 'pickup', 'digital']),
  note: union([string().check(maxLength(200)), nullSchema()]),
  scheduledAt: union([isoUtc, nullSchema()]),
});
const quoteSelection = strictObject({
  cartVersion: version,
  lines: array(selectedLine).check(minLength(1), maxLength(100)),
  addressId: union([id<'address'>(), nullSchema()]),
  invoiceId: union([id<'invoiceprofile'>(), nullSchema()]),
  delivery: deliveryChoice,
  voucherIds: array(id<'voucher'>()).check(maxLength(20)),
  benefits: array(benefitChoice).check(maxLength(10)),
  paymentScene: literal(['miniapp', 'jsapi']),
});
const quoteLine = strictObject({
  listing: string(),
  sku: string(),
  product: string(),
  productType: string(),
  category: string(),
  title: string(),
  quantity: unsigned,
  unitMinor: unsigned,
  totalMinor: unsigned,
  discountMinor: unsigned,
  payableMinor: unsigned,
  provider: union([string(), nullSchema()]),
  partner: union([string(), nullSchema()]),
  stockitem: union([string(), nullSchema()]),
  versions: record(string(), union([string(), number()])),
  accepted: boolean(),
  reasons: array(string()),
});
const tender = strictObject({ kind: literal(['benefit', 'voucher', 'wechat']), reference: union([string(), nullSchema()]), amountMinor: unsigned });
const rejection = strictObject({ listing: string(), reasons: array(string()) });
const quoteResult = strictObject({
  checkoutId: string(),
  quoteId: string(),
  quoteVersion: version,
  confirmationToken: union([string().check(minLength(43), maxLength(171)), nullSchema()]),
  evidenceHash: string().check(minLength(64), maxLength(64)),
  expiresAt: isoUtc,
  selection: quoteSelection,
  cartVersion: version,
  lines: array(quoteLine),
  evidence: record(string(), ContractJsonValueSchema),
  subtotalMinor: unsigned,
  discountMinor: unsigned,
  shippingMinor: unsigned,
  taxMinor: unsigned,
  payableMinor: unsigned,
  benefitMinor: unsigned,
  personalMinor: unsigned,
  currency,
  tenders: array(tender),
  rejections: array(rejection),
});

export const CHECKOUT_QUERY_SCHEMAS = {
  CheckoutQuotesCurrentReadInput: strictObject({}),
} as const;

export const CHECKOUT_BODY_SCHEMAS = {
  CheckoutQuoteCreateInput: strictObject({
    cartVersion: version,
    lines: array(selectedLine).check(minLength(1), maxLength(100)),
    addressId: optional(id<'address'>()),
    invoiceId: optional(id<'invoiceprofile'>()),
    delivery: strictObject({
      method: optional(literal(['standard', 'express', 'pickup', 'digital'])),
      note: optional(string().check(maxLength(200))),
      scheduledAt: optional(isoUtc),
    }),
    voucherIds: array(id<'voucher'>()).check(maxLength(20)),
    benefits: array(benefitChoice).check(maxLength(10)),
    paymentScene: literal(['miniapp', 'jsapi']),
  }),
} as const;

export const CHECKOUT_OUTPUT_SCHEMAS = {
  CheckoutQuoteCreateOutput: quoteResult,
  CheckoutQuotesCurrentReadOutput: strictObject({ quote: union([quoteResult, nullSchema()]) }),
} as const;
