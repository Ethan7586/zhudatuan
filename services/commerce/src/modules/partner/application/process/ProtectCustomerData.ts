import { randomUUID } from 'node:crypto';
import type { OperationInputFor } from '@shop/contract';
import type { PrepareContext } from '../../../../foundation/application/HandlerContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CipherEnvelope, KmsClient } from '../../../../foundation/application/KmsPort';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Agreement } from '../../domain/model/Agreement';
import { Contact, type ContactKind } from '../../domain/model/Contact';
import { Customer, type CustomerKind } from '../../domain/model/Customer';
import { PartnerPolicy } from '../../domain/policy/PartnerPolicy';
import type { CreateCustomerCommand, PreparedAgreement, ProtectedContact, UpdateCustomerCommand } from '../port/CustomerRepository';

export class ProtectCustomerData {
  private readonly policy = new PartnerPolicy();

  constructor(private readonly kms: KmsClient) {}

  async create(input: OperationInputFor<'partner.customers.create'>, context: PrepareContext<'partner.customers.create'>): Promise<CreateCustomerCommand> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const id = `partnercustomer:${randomUUID()}`;
    const identifier = this.policy.identifier(textField(body, 'identifier', 64));
    const name = textField(body, 'name', 160);
    const kind = customerKind(body.kind);
    new Customer(id, kind, name, 'draft', 1);
    const [identifierEnvelope, contact] = await Promise.all([
      this.kms.encrypt('pii', 'partner/customer/identifier', identifier, { customer: id, scope: access.scope.id }),
      this.contact(body.contact, id, access.scope.id),
    ]);
    return Object.freeze({
      id,
      tenant: this.policy.tenant(access.scope),
      scope: access.scope.id,
      identifier: identifierEnvelope,
      identifierMasked: this.policy.maskedIdentifier(identifier),
      name,
      kind,
      actor: access.membership.id,
      contact,
      agreement: this.agreement(body.agreement),
    });
  }

  async update(input: OperationInputFor<'partner.customers.update'>, context: PrepareContext<'partner.customers.update'>): Promise<UpdateCustomerCommand> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const expectedVersion = context.expectedVersion;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion! < 1) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    if (Object.keys(body).length === 0) throw new DomainError('VALIDATION_FAILED');
    const identifier = body.identifier === undefined ? undefined : this.policy.identifier(textField(body, 'identifier', 64));
    const envelope = identifier === undefined ? undefined : await this.kms.encrypt('pii', 'partner/customer/identifier', identifier, { customer: input.path.customerid, scope: access.scope.id });
    const contact = body.contact === undefined ? undefined : await this.contact(body.contact, input.path.customerid, access.scope.id);
    return Object.freeze({
      id: input.path.customerid,
      scope: access.scope.id,
      actor: access.membership.id,
      expectedVersion: expectedVersion!,
      ...(envelope === undefined ? {} : { identifier: envelope, identifierMasked: this.policy.maskedIdentifier(identifier!) }),
      ...(body.name === undefined ? {} : { name: textField(body, 'name', 160) }),
      ...(body.kind === undefined ? {} : { kind: customerKind(body.kind) }),
      ...(contact === undefined ? {} : { contact }),
      ...(body.agreement === undefined ? {} : { agreement: this.agreement(body.agreement)! }),
    });
  }

  private async contact(value: unknown, customer: string, scope: string): Promise<ProtectedContact> {
    const body = object(value);
    const kind = (body.kind ?? 'primary') as ContactKind;
    if (!['primary', 'billing', 'operations'].includes(kind)) throw new DomainError('PARTNER_CONTACT_INVALID');
    const contact = new Contact(kind, {
      name: textField(body, 'name', 128),
      ...(body.phone === undefined ? {} : { phone: textField(body, 'phone', 32) }),
      ...(body.email === undefined ? {} : { email: textField(body, 'email', 254) }),
    });
    const context = { customer, scope, kind };
    const [name, phone, email] = await Promise.all([
      this.kms.encrypt('pii', 'partner/customer/contact/name', contact.name, context),
      encryptOptional(this.kms, 'partner/customer/contact/phone', contact.phone, context),
      encryptOptional(this.kms, 'partner/customer/contact/email', contact.email, context),
    ]);
    const masked = contact.masked();
    return Object.freeze({ id: `customercontact:${randomUUID()}`, kind, name, phone, email, nameMasked: masked.name, phoneMasked: masked.phone, emailMasked: masked.email });
  }

  private agreement(value: unknown): PreparedAgreement | null {
    if (value === undefined || value === null) return null;
    const body = object(value);
    const agreement = new Agreement({
      contractRef: textField(body, 'contractRef', 128),
      contractHash: textField(body, 'contractHash', 64),
      capabilities: stringArray(body.capabilities),
      effectiveAt: textField(body, 'effectiveAt', 32),
      expiresAt: textField(body, 'expiresAt', 32),
    });
    return Object.freeze({
      id: `customeragreement:${randomUUID()}`,
      contractRef: agreement.contractRef,
      contractHash: agreement.contractHash,
      capabilities: agreement.capabilities,
      status: agreement.state(new Date()),
      effectiveAt: agreement.effectiveAt.toISOString(),
      expiresAt: agreement.expiresAt.toISOString(),
    });
  }
}

function object(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION_FAILED');
  return value as Readonly<Record<string, unknown>>;
}

function customerKind(value: unknown): CustomerKind {
  if (value === 'enterprise' || value === 'institution' || value === 'government') return value;
  throw new DomainError('VALIDATION_FAILED');
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new DomainError('PARTNER_AGREEMENT_PERIOD_INVALID');
  return value as readonly string[];
}

function encryptOptional(kms: KmsClient, key: string, value: string | null, context: Readonly<Record<string, string>>): Promise<CipherEnvelope | null> {
  return value === null ? Promise.resolve(null) : kms.encrypt('pii', key, value, context);
}
