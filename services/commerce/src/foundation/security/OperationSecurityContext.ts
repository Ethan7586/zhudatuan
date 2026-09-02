import { DomainError } from '../domain/DomainError';
import type { AccessContext } from './AccessContext';

export type ClientTarget = 'console' | 'storefront';
export type PreauthPurpose = 'federationselection' | 'invitationproof' | 'enrollment';

export interface AnonymousSecurityContext {
  readonly kind: 'anonymous';
  readonly channel: 'public' | 'system' | 'webhook';
  readonly target: ClientTarget | null;
  readonly trace: string;
}

export interface PreauthSecurityContext {
  readonly kind: 'preauth';
  readonly id: string;
  readonly purpose: PreauthPurpose;
  readonly target: ClientTarget;
  readonly principal: string | null;
  readonly reference: string;
  readonly version: number;
  readonly expires: Date;
  readonly trace: string;
  readonly authorization: Readonly<{ stateHash: string; nonceHash: string; challenge: string }> | null;
  readonly returnTarget: string | null;
}

export interface SessionSecurityContext {
  readonly kind: 'session';
  readonly access: AccessContext;
}

export type OperationSecurityContext = AnonymousSecurityContext | PreauthSecurityContext | SessionSecurityContext;

export function requireAnonymous(context: OperationSecurityContext): AnonymousSecurityContext {
  if (context.kind !== 'anonymous') throw new Error('ANONYMOUS_CONTEXT_REQUIRED');
  return context;
}

export function requirePreauth(context: OperationSecurityContext, purpose: PreauthPurpose): PreauthSecurityContext {
  if (context.kind !== 'preauth' || context.purpose !== purpose) throw new Error('PREAUTH_CONTEXT_REQUIRED');
  return context;
}

export function requireSession(context: OperationSecurityContext): AccessContext {
  if (context.kind !== 'session') throw new DomainError('AUTHENTICATION_REQUIRED');
  return context.access;
}

export function requireExactTarget(context: OperationSecurityContext, target: ClientTarget): void {
  const actual = context.kind === 'session' ? context.access.actor.target : context.target;
  if (actual !== target) throw new DomainError('AUTHORIZATION_DENIED');
}

export function requireActionProof(headers: Readonly<Record<string, string>>): string {
  const proof = headers['x-action-proof'];
  if (!proof || !/^[A-Za-z0-9_-]{43,128}$/.test(proof)) throw new DomainError('ACTION_PROOF_REQUIRED');
  return proof;
}

export function sessionAccess(context: OperationSecurityContext): AccessContext | undefined {
  return context.kind === 'session' ? context.access : undefined;
}
