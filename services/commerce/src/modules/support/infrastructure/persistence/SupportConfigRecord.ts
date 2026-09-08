import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, integerField, keysetPage, queryPage, textField } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { AssignmentRule } from '../../domain/model/AssignmentRule';
import { Sla } from '../../domain/model/Sla';
import type { TicketPriority } from '../../domain/model/Ticket';
import type { AccountRepository, PreparedSupportOperation, RuleRepository, SlaRepository } from '../../application/port/SupportRepositories';
import type { SupportAccountProvider, SupportAccountVerification, SupportAccountVerifier } from '../../application/port/SupportAccountVerifier';
import type { ReadSupportContext } from '../../application/service/ReadSupportContext';
import type { AssignmentRuleStore } from '../../application/port/SupportPersistence';

export interface LoadedAccount {
  readonly scope: string;
  readonly current: Pick<AccountRow, 'secret_ref' | 'channel'> | null;
}
export type PreparedAccount = SupportAccountVerification;
export interface AccountRow {
  readonly id: string;
  readonly scope_id: string;
  readonly channel: SupportAccountProvider;
  readonly external_ref: string;
  readonly secret_ref: string | null;
  readonly state: 'active' | 'disabled';
  readonly validation_state: 'verified' | 'notrequired' | 'unverified';
  readonly validation_code: string;
  readonly validated_at: string | Date | null;
  readonly secret_version: string | null;
  readonly version: number;
}
export type AccountReadRow = Omit<AccountRow, 'scope_id' | 'secret_ref' | 'secret_version'>;
export interface RuleRow {
  readonly id: string;
  readonly scope_id: string;
  readonly name: string;
  readonly skill: string;
  readonly priorities: TicketPriority[];
  readonly weight: number;
  readonly state: 'active' | 'disabled';
  readonly version: number;
  readonly created_at: string;
  readonly updated_at: string;
}
export interface RuleReadRow {
  readonly id: string;
  readonly name: string;
  readonly skill: string;
  readonly priorities: TicketPriority[];
  readonly weight: number;
  readonly state: 'active' | 'disabled';
  readonly version: number;
  readonly updated_at: string;
}
export interface SlaRow {
  readonly id: string;
  readonly scope_id: string;
  readonly priority: TicketPriority;
  readonly response_seconds: number;
  readonly resolution_seconds: number;
  readonly reopen_seconds: number;
  readonly version: number;
}
export function rule(row: RuleRow) {
  return { ...row, weight: Number(row.weight), version: Number(row.version), created_at: instant(row.created_at), updated_at: instant(row.updated_at) };
}
export function ruleRead(row: RuleReadRow) {
  return { ...row, weight: Number(row.weight), version: Number(row.version), updated_at: instant(row.updated_at) };
}
export function sla(row: SlaRow) {
  return { ...row, response_seconds: Number(row.response_seconds), resolution_seconds: Number(row.resolution_seconds), reopen_seconds: Number(row.reopen_seconds), version: Number(row.version) };
}
export function slaRead(row: SlaRow) {
  const value = sla(row);
  return { id: value.id, priority: value.priority, response_seconds: value.response_seconds, resolution_seconds: value.resolution_seconds, reopen_seconds: value.reopen_seconds, version: value.version };
}
export function account(row: AccountRow) {
  return {
    id: row.id,
    scope_id: row.scope_id,
    provider: row.channel,
    display_name: row.external_ref,
    state: row.state,
    validation_state: row.validation_state,
    validation_code: row.validation_code,
    validated_at: row.validated_at === null ? null : instant(row.validated_at),
    version: Number(row.version),
  };
}
export function accountRead(row: AccountReadRow) {
  return {
    id: row.id,
    provider: row.channel,
    display_name: row.external_ref,
    state: row.state,
    validation_state: row.validation_state,
    validation_code: row.validation_code,
    validated_at: row.validated_at === null ? null : instant(row.validated_at),
    version: Number(row.version),
  };
}
export function expectedVersion(execution: ExecutionContext): number {
  if (execution.expectedVersion === undefined) throw new DomainError('VERSION_CONFLICT');
  return execution.expectedVersion;
}
export function choice(value: unknown, values: readonly string[], code: string): string {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(code);
  return value;
}
export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'string' && item.trim())) throw new DomainError('VALIDATION_FAILED');
  return [...new Set(value.map((item) => item.trim()))];
}
export function instant(value: string | Date): string {
  return new Date(value).toISOString();
}
export const priorities = ['low', 'normal', 'high', 'urgent'] as const;
export const channels = ['inapp', 'wechat', 'email', 'sms'] as const;
export const enabledStates = ['active', 'disabled'] as const;
