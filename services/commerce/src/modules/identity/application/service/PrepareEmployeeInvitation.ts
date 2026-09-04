import { randomUUID } from 'node:crypto';
import type { IdentityInvitationsCreateBody } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { KmsClient } from '../../../../foundation/application/KmsPort';
import type { InvitationCodePort, InvitationDigest, InvitationHashPort } from '../port/InvitationSecurity';
import { canonicalMobile } from '../../domain/value/IdentitySubject';

type EmployeeInvitationBody = Extract<IdentityInvitationsCreateBody, Readonly<{ kind: 'enrollment' }>>;

export class OneTimeInvitationCode {
  private value: string | undefined;

  constructor(value: string) {
    this.value = value;
  }

  reveal(): string {
    if (this.value === undefined) throw new Error('INVITATION_CODE_CLEARED');
    return this.value;
  }

  clear(): void {
    this.value = undefined;
  }
}

export interface PreparedEmployeeInvitation {
  readonly kind: 'enrollment';
  readonly target: 'storefront';
  readonly organization: string;
  readonly principal: string;
  readonly member: string;
  readonly membership: string;
  readonly displayName: string;
  readonly employeeNo: string | null;
  readonly department: string | null;
  readonly mobileCiphertext: string;
  readonly mobileFingerprint: string;
  readonly mobileMasked: string;
  readonly recipientHash: Buffer;
  readonly invitation: string;
  readonly token: InvitationDigest;
  readonly code: OneTimeInvitationCode;
  readonly expiresAt: Date;
  readonly reason: string;
  readonly createdAt: Date;
}

export class PrepareEmployeeInvitation {
  constructor(
    private readonly kms: KmsClient,
    private readonly generator: InvitationCodePort,
    private readonly hasher: InvitationHashPort
  ) {}

  async prepare(body: EmployeeInvitationBody): Promise<PreparedEmployeeInvitation> {
    const displayName = display(body.employee.displayName);
    const employeeNo = employee(body.employee.employeeNo);
    const department = identifier(body.employee.departmentId, 'departmentId');
    const organization = identifier(body.organizationId, 'organizationId')!;
    const expiresAt = expiry(body.expiresAt);
    const reason = required(body.reason, 'reason', 4, 1000);
    const mobile = canonicalMobile(body.employee.mobile);
    const principal = `principal:${randomUUID()}`;
    const envelope = await this.kms.encrypt('pii', 'identity/mobile', mobile, { principal });
    const issued = this.generator.issue();
    return Object.freeze({
      kind: 'enrollment',
      target: 'storefront',
      organization,
      principal,
      member: `member:${randomUUID()}`,
      membership: `membership:${randomUUID()}`,
      displayName,
      employeeNo,
      department,
      mobileCiphertext: envelope.ciphertext,
      mobileFingerprint: envelope.fingerprint,
      mobileMasked: mask(mobile),
      recipientHash: this.hasher.recipient(mobile),
      invitation: `invitation:${randomUUID()}`,
      token: this.hasher.current(issued),
      code: new OneTimeInvitationCode(issued.display()),
      expiresAt,
      reason,
      createdAt: new Date(),
    });
  }
}

function display(value: string): string {
  return required(value, 'displayName', 1, 128);
}

function employee(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) return null;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(normalized)) throw new DomainError('VALIDATION_FAILED', { field: 'employeeNo' });
  return normalized;
}

function identifier(value: string | undefined, field: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9:.-]{0,159}$/.test(normalized)) throw new DomainError('VALIDATION_FAILED', { field });
  return normalized;
}

function expiry(value: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
  return parsed;
}

function required(value: string, field: string, minimum: number, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) throw new DomainError('VALIDATION_FAILED', { field });
  return normalized;
}

function mask(value: string): string {
  return `${value.slice(0, Math.max(3, value.length - 8))}****${value.slice(-4)}`;
}
