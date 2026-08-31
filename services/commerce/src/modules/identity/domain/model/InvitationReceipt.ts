export class InvitationReceipt {
  readonly id: string;
  readonly invitation: string;
  readonly principal: string;
  readonly membership: string;
  readonly session: string | null;
  readonly assurance: 1 | 2 | 3;
  readonly issuerAccessVersion: number;
  readonly grantDigest: string;
  readonly redeemedAt: Date;
  readonly trace: string;

  constructor(value: Readonly<{ id: string; invitation: string; principal: string; membership: string; session: string | null; assurance: 1 | 2 | 3; issuerAccessVersion: number; grantDigest: string; redeemedAt: Date; trace: string }>) {
    if (
      !value.id ||
      !value.invitation ||
      !value.principal ||
      !value.membership ||
      !value.trace ||
      !Number.isSafeInteger(value.issuerAccessVersion) ||
      value.issuerAccessVersion < 0 ||
      !/^[0-9a-f]{64}$/.test(value.grantDigest) ||
      !Number.isFinite(value.redeemedAt.getTime())
    ) {
      throw new Error('INVITATION_RECEIPT_INVALID');
    }
    this.id = value.id;
    this.invitation = value.invitation;
    this.principal = value.principal;
    this.membership = value.membership;
    this.session = value.session;
    this.assurance = value.assurance;
    this.issuerAccessVersion = value.issuerAccessVersion;
    this.grantDigest = value.grantDigest;
    this.redeemedAt = value.redeemedAt;
    this.trace = value.trace;
    Object.freeze(this);
  }
}
