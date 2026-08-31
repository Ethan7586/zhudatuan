import type { DirectoryConnection } from '../../domain/model/DirectoryConnection';

export interface ExternalDirectorySubject {
  readonly externalid: string;
  readonly type: 'user' | 'department';
  readonly name: string;
  readonly parentid: string | null;
  readonly departments: readonly string[];
  readonly status: 'active' | 'inactive';
  readonly version: number;
  readonly explicitdeparture: boolean;
}
export interface DirectoryPage {
  readonly eventid: string;
  readonly version: number;
  readonly tenant: string;
  readonly subjects: readonly ExternalDirectorySubject[];
  readonly cursor: string | null;
  readonly complete: boolean;
}
export interface DirectoryProvider {
  readonly type: 'wecomcorp' | 'wecomsuite';
  changes(connection: DirectoryConnection, cursor: string | null, signal: AbortSignal): Promise<DirectoryPage>;
  event(connection: DirectoryConnection, payload: string): DirectoryPage;
  verify(connection: DirectoryConnection, body: string, headers: Readonly<Record<string, string>>, query: Readonly<Record<string, string | readonly string[]>>): Promise<Readonly<{ eventid: string; version: number; payload: string }>>;
}
