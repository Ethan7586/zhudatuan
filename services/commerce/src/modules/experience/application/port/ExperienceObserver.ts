import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { EntryState } from '../../domain/policy/EntryPolicy';

export interface EntryResolveObservation {
  readonly cache: 'hit' | 'miss';
  readonly result: 'success' | 'failure';
  readonly milliseconds: number;
  readonly errorCode?: string;
}

export interface PublicationObservation {
  readonly trace: string;
  readonly result: 'success' | 'failure';
  readonly milliseconds: number;
  readonly errorCode?: string;
}

export interface ExperienceObserver {
  resolve(context: ReadTransactionContext, observation: EntryResolveObservation): void;
  states(context: ReadTransactionContext, counts: Readonly<Record<EntryState, number>>): void;
  publication(observation: PublicationObservation): void;
}
