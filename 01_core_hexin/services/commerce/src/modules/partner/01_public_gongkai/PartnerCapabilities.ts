export const PARTNER_CAPABILITIES = Object.freeze({
  read: 'partner.read',
  manage: 'partner.manage',
});

export type PartnerCapability = (typeof PARTNER_CAPABILITIES)[keyof typeof PARTNER_CAPABILITIES];
