export interface Membership {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly current: boolean;
  readonly accessVersion: number;
}
