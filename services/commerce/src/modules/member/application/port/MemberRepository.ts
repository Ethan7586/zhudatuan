import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface MembershipProfile {
  readonly id: string;
  readonly member: string;
  readonly organization: string;
  readonly employee: string | null;
  readonly status: string;
  readonly accessVersion: number;
  readonly joinedAt: string;
}

export interface MemberProfile {
  readonly id: string;
  readonly displayName: string;
  readonly status: string;
  readonly mobileBound: boolean;
}

export interface ImportRecord extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly state: string;
  readonly reportObjectRef: string | null;
  readonly reportSha256: string | null;
  readonly reportSize: number | null;
}

export interface MemberRepository {
  memberships(context: ReadTransactionContext, organization: string, after: string | null, fetch: number): Promise<readonly MembershipProfile[]>;
  profiles(context: ReadTransactionContext, members: readonly string[]): Promise<readonly MemberProfile[]>;
  membership(context: ReadTransactionContext, membership: string): Promise<MembershipProfile>;
  profile(context: ReadTransactionContext, member: string): Promise<MemberProfile | null>;
  favorites(context: ReadTransactionContext, member: string, sort: string | null, id: string | null, fetch: number): Promise<readonly Readonly<Record<string, unknown>>[]>;
  putFavorite(context: WriteTransactionContext, member: string, listing: string, organization: string, favorite: boolean): Promise<Readonly<Record<string, unknown>>>;
  createImport(context: WriteTransactionContext, input: Readonly<{ id: string; organization: string; reference: string; sha256: string }>): Promise<Readonly<Record<string, unknown>>>;
  readImport(context: ReadTransactionContext, id: string, organization: string): Promise<ImportRecord | null>;
}
