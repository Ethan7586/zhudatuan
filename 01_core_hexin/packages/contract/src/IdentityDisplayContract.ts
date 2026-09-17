import * as z from 'zod/mini';

const maskedMobile = z.optional(z.string().check(z.minLength(1)));

export const OperatorIdentityDisplayHintSchema = z.strictObject({
  kind: z.literal('operator'),
  code: z.string().check(z.regex(/^OP-[2-9A-HJKMNP-Z]{6}$/)),
  label: z.literal('管理身份'),
  maskedMobile,
});

export const MemberIdentityDisplayHintSchema = z.strictObject({
  kind: z.literal('member'),
  code: z.string().check(z.regex(/^MB-[0-9A-HJKMNP-Z]{8}$/)),
  label: z.literal('会员身份'),
  maskedMobile,
});

export const IdentityDisplayHintSchema = z.union([
  OperatorIdentityDisplayHintSchema,
  MemberIdentityDisplayHintSchema,
]);

export type IdentityDisplayHint = z.infer<typeof IdentityDisplayHintSchema>;
