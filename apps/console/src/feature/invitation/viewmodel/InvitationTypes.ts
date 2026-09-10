export type InvitationCreateKind = 'choice' | 'employee' | 'campaign' | 'signin';

export interface InvitationDepartment {
  readonly id: string;
  readonly name: string;
}
