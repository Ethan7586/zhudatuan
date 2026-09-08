import type { DeliveryChannelId, DeliveryVariables, VariableSchema } from '../../domain/model/Template';
import type { ConsentSource } from '../../domain/model/Preference';
import type { DeliveryFailureClass } from '../../domain/model/Dispatch';
import type { DeliveryReceipt } from './DeliveryChannel';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface TemplateRecord {
  readonly id: string;
  readonly scope_id: string;
  readonly channel: DeliveryChannelId;
  readonly event_type: string;
  readonly version: number;
  readonly variable_schema: VariableSchema;
  readonly provider_template: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly status: 'draft' | 'active' | 'retired';
  readonly created_at: string;
  readonly purpose: 'transactional' | 'marketing';
  readonly mandatory: boolean;
  readonly preference_enabled: boolean;
  readonly authorization_state: 'unknown' | 'accepted' | 'rejected';
  readonly consent_source: ConsentSource;
  readonly quiet_start: string | null;
  readonly quiet_end: string | null;
  readonly quiet_timezone: string | null;
  readonly preference_version: number;
}
export interface DispatchRecord {
  readonly id: string;
  readonly scope_id: string;
  readonly member_id: string | null;
  readonly template_id: string;
  readonly channel: DeliveryChannelId;
  readonly event_type: string;
  readonly template_version: number;
  readonly provider_template: string | null;
  readonly variable_schema: VariableSchema;
  readonly subject: string | null;
  readonly body: string;
  readonly payload: DeliveryVariables;
  readonly recipient_ciphertext: string | null;
  readonly recipient_ref: string | null;
  readonly purpose: 'transactional' | 'marketing';
  readonly mandatory: boolean;
  readonly attempt_sequence: number;
  readonly max_attempts: number;
  readonly preference_enabled: boolean;
  readonly authorization_state: 'unknown' | 'accepted' | 'rejected';
  readonly consent_source: ConsentSource;
  readonly quiet_start: string | null;
  readonly quiet_end: string | null;
  readonly quiet_timezone: string | null;
  readonly preference_version: number;
}
export interface EndpointRecord {
  readonly address_ciphertext: string;
  readonly address_token: string;
}
export interface ChallengeRecord {
  readonly purpose: string;
  readonly codeCiphertext: string;
  readonly destinationCiphertext: string;
}
export interface ChallengeAttemptRecord {
  readonly sequence: number;
  readonly state: 'sending' | 'sent' | 'ambiguous';
  readonly dispatch: boolean;
}

export interface QueuedDispatch {
  readonly id: string;
  readonly scope: string;
  readonly member: string | null;
  readonly template: string;
  readonly recipientToken: string;
  readonly recipientCiphertext: string | null;
  readonly recipientKeyVersion: string | null;
  readonly recipientRef: string | null;
  readonly variables: DeliveryVariables;
  readonly subject: string | null;
  readonly body: string;
  readonly idempotency: string;
  readonly event: string;
  readonly templateVersion: number;
  readonly providerTemplate: string | null;
  readonly variableSchema: VariableSchema;
  readonly purpose: 'transactional' | 'marketing';
  readonly mandatory: boolean;
  readonly availableAt: string;
}

export interface DeliveryRepository {
  jobScope(context: ReadTransactionContext, job: string): Promise<string | null>;
  eventTemplates(context: ReadTransactionContext, scope: string, event: string, member: string | null): Promise<readonly TemplateRecord[]>;
  endpoint(context: ReadTransactionContext, member: string, channel: DeliveryChannelId): Promise<EndpointRecord | null>;
  queue(context: WriteTransactionContext, input: QueuedDispatch): Promise<void>;
  completeInbox(context: WriteTransactionContext, event: string): Promise<void>;
  claim(context: WriteTransactionContext, id: string): Promise<DispatchRecord | null>;
  complete(context: WriteTransactionContext, dispatch: DispatchRecord, receipt: DeliveryReceipt, route: number): Promise<void>;
  recordFailure(context: WriteTransactionContext, dispatch: DispatchRecord, provider: string, route: number, failure: Readonly<{ kind: DeliveryFailureClass; code: string }>): Promise<void>;
  fail(context: WriteTransactionContext, dispatch: DispatchRecord, provider: string, route: number, failure: Readonly<{ kind: DeliveryFailureClass; code: string }>): Promise<boolean>;
  cancel(context: WriteTransactionContext, dispatch: DispatchRecord, reason: string): Promise<void>;
  defer(context: WriteTransactionContext, dispatch: DispatchRecord, availableAt: string): Promise<void>;
  challenge(context: ReadTransactionContext, id: string): Promise<ChallengeRecord | null>;
  beginChallengeAttempt(context: WriteTransactionContext, id: string, provider: string): Promise<ChallengeAttemptRecord | null>;
  completeChallengeAttempt(context: WriteTransactionContext, id: string, sequence: number, provider: string, external: string): Promise<boolean>;
  failChallengeAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void>;
  ambiguousChallengeAttempt(context: WriteTransactionContext, id: string, sequence: number, code: string): Promise<void>;
}
