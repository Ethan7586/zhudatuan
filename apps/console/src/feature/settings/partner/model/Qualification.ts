export interface PartnerQualification {
  readonly valid: number;
  readonly pending: number;
  readonly rejected: number;
  readonly expired: number;
  readonly nearestExpiry: string | null;
}
