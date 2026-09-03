export interface SupportContext {
  readonly member: Readonly<{ id: string; displayName: string; employeeNo: string | null; mobileMasked: string | null }>;
  readonly organization: Readonly<{ id: string }>;
  readonly orders: readonly Readonly<{ id: string; number: string; state: string; totalMinor: number }>[];
  readonly benefits: readonly Readonly<{ id: string; state: string; kind: string; currency: string; remainingMinor: number; expiresAt: string | null }>[];
}
