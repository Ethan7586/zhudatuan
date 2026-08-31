import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHash, randomBytes } from 'node:crypto';
import { IDENTITY_PROVIDER_CONFIGURATION } from '@shop/config/server';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SessionIssuer } from '../port/SessionIssuer';
import type { FederationRepository } from '../port/FederationRepository';
import type { LinkCaseRepository } from '../port/LinkCaseRepository';
import type { ProviderResolver } from './ProviderResolver';
import type { SubjectHasher } from '../../domain/service/SubjectHasher';
import type { FederationProtector } from '../../domain/service/FederationProtector';
import type { NonceService } from '../../domain/service/NonceService';
import type { ReturnTargetPort } from '../port/ReturnTargetPort';
import type { OperationResult } from '../../../../foundation/application/OperationExecution';
import type { IdentityOrganizationPort } from '../../../organization/public';
import type { IdentityAccessPort } from '../../../access/public';
import { FederationPolicy } from '../../domain/policy/FederationPolicy';
import { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { SessionCookiePort } from '../port/SessionCookiePort';
import type { IdentityLinkRepository } from '../port/IdentityLinkRepository';

export interface FederationRequestContext {
  readonly peer: string;
  readonly agent: string;
  readonly device: string;
  readonly trace: string;
  readonly signal?: AbortSignal;
  readonly deadline?: number;
}
export class FederationService {
  constructor(
    private readonly repository: FederationRepository,
    private readonly cases: LinkCaseRepository,
    private readonly providers: ProviderResolver,
    private readonly subjects: SubjectHasher,
    private readonly protector: FederationProtector,
    private readonly nonces: NonceService,
    private readonly kms: KmsClient,
    private readonly sessions: SessionIssuer,
    private readonly returns: ReturnTargetPort,
    private readonly organizations: IdentityOrganizationPort,
    private readonly access: IdentityAccessPort,
    private readonly cookies: SessionCookiePort,
    private readonly links: IdentityLinkRepository,
    private readonly policy: FederationPolicy = new FederationPolicy()
  ) {}

  async start(database: OperationDatabase, input: Readonly<{ provider: string; returntarget: string; authorization: unknown }>, context: FederationRequestContext): Promise<OperationResult> {
    return this.begin(database, { ...input, purpose: 'signin', principal: null, membership: null }, context);
  }

  async startLink(
    database: OperationDatabase,
    input: Readonly<{ provider: string; returntarget: string; authorization: unknown; principal: string; membership: string; target: 'console' | 'storefront' }>,
    context: FederationRequestContext
  ): Promise<OperationResult> {
    const target = this.returns.verify(input.returntarget);
    if (target.target !== input.target) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
    return this.begin(database, { ...input, purpose: 'link' }, context);
  }

  private async begin(
    database: OperationDatabase,
    input: Readonly<{ provider: string; returntarget: string; authorization: unknown; purpose: 'signin' | 'link'; principal: string | null; membership: string | null }>,
    context: FederationRequestContext
  ): Promise<OperationResult> {
    const target = this.returns.verify(input.returntarget);
    const { instance, strategy } = await this.providers.require(database, input.provider);
    if (target.tenant !== undefined && target.tenant !== instance.tenantid) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    const state = this.nonces.issue();
    const nonce = this.nonces.issue();
    const verifier = this.nonces.issue(48);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    this.policy.assertPkce(challenge);
    this.policy.assertTarget(target.target);
    const protectedVerifier = await this.kms.encrypt('evidence', 'identity/federation', verifier, { provider: instance.id, state: state.slice(0, 12) });
    const authorization = AuthTransaction.start(input.authorization);
    const transaction = await this.repository.create(database, {
      provider: instance.id,
      statehash: this.nonces.hash(state),
      noncehash: this.nonces.hash(nonce),
      challenge,
      verifier: protectedVerifier.ciphertext,
      browserhash: this.protector.browser(context.peer, context.agent, context.device),
      returntargethash: this.protector.returnTarget(input.returntarget),
      returntarget: input.returntarget,
      target: target.target,
      riskhash: this.protector.risk(context.peer, context.agent),
      expiresat: new Date(Date.now() + IDENTITY_PROVIDER_CONFIGURATION.transactionTtlSeconds * 1_000),
      authorization: Object.freeze({ stateHash: authorization.stateHash, nonceHash: authorization.nonceHash, challenge: authorization.challenge }),
      purpose: input.purpose,
      principal: input.principal,
      membership: input.membership,
    });
    const redirect = await strategy.start({ instance, state, nonce, challenge });
    await this.repository.redirected(database, transaction);
    return Object.freeze({ status: 303, headers: Object.freeze({ location: redirect.location, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }) });
  }

  async callback(database: OperationDatabase, input: Readonly<{ provider: string; state: string; code: string }>, context: FederationRequestContext): Promise<OperationResult> {
    const accepted = await this.repository.callback(database, input.provider, this.nonces.hash(input.state));
    if (!this.protector.equal(accepted.browserhash, this.protector.browser(context.peer, context.agent, context.device))) {
      throw new DomainError('FEDERATION_TRANSACTION_INVALID');
    }
    const { instance, strategy } = await this.providers.require(database, input.provider);
    const verifier = await this.kms.decrypt('evidence', 'identity/federation', accepted.verifierciphertext, { provider: instance.id, state: input.state.slice(0, 12) });
    const subject = await strategy.callback({ instance, code: input.code, state: input.state, noncehash: accepted.noncehash, verifier, signal: context.signal, deadline: context.deadline });
    const subjecthash = this.subjects.hash({ provider: subject.provider, instance: subject.instance, tenant: subject.tenant, subject: subject.subject });
    let resolution = await this.repository.verified(database, accepted.transaction, subject, subjecthash);
    const verified = accepted.transaction.transition('verified', new Date());
    if (accepted.transaction.purpose === 'link') {
      if (!accepted.transaction.principal || !accepted.transaction.membership) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
      if (resolution.conflict || (resolution.principal !== null && resolution.principal !== accepted.transaction.principal)) {
        throw new DomainError('FEDERATION_LINK_CONFLICT');
      }
      if (resolution.principal === null) {
        const envelope = await this.kms.encrypt('pii', 'identity/federatedsubject', subject.subject, {
          principal: accepted.transaction.principal,
          provider: instance.id,
        });
        await this.links.create(database, {
          principal: accepted.transaction.principal,
          membership: accepted.transaction.membership,
          provider: instance.id,
          subjecthash,
          ciphertext: envelope.ciphertext,
          keyversion: envelope.keyVersion,
        });
      }
      await this.repository.complete(database, accepted.transaction.id, verified.version);
      return Object.freeze({
        status: 303,
        headers: Object.freeze({ location: this.returns.verify(accepted.returntarget).url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }),
      });
    }
    if (resolution.principal === null && !resolution.conflict) {
      const bindings = await this.organizations.directoryBindings(database, instance.id, subjecthash);
      const names = new Map(bindings.map((binding) => [binding.id, binding.name]));
      const authorized = await this.access.directoryMemberships(
        database,
        bindings.map((binding) => binding.id)
      );
      resolution = Object.freeze({
        principal: authorized.principal,
        conflict: authorized.conflict,
        memberships: Object.freeze(authorized.memberships.map((membership) => Object.freeze({ ...membership, name: names.get(membership.id) ?? membership.id }))),
      });
      if (resolution.principal !== null && resolution.memberships[0]) {
        const envelope = await this.kms.encrypt('pii', 'identity/federation', subject.subject, { provider: instance.id });
        await this.repository.bindDirectory(database, { provider: instance.id, principal: resolution.principal, membership: resolution.memberships[0].id, subjecthash, ciphertext: envelope.ciphertext, keyversion: envelope.keyVersion });
      }
    }
    if (resolution.conflict || resolution.principal === null || resolution.memberships.length === 0) {
      const reason = resolution.conflict ? 'principalconflict' : 'unlinked';
      await this.cases.create(database, instance.id, instance.tenantid, subjecthash, reason, accepted.transaction.id);
      await this.repository.advance(database, verified, 'linkrequired');
      return this.authRedirect('/link', accepted.transaction.target, { code: 'FEDERATION_LINK_REQUIRED' });
    }
    const candidates = resolution.memberships.filter(({ target }) => target === accepted.transaction.target);
    if (candidates.length !== 1) {
      const preauth = await this.repository.preauthorize(database, verified, resolution.principal, candidates, accepted.browserhash, this.protector.device(context.device), subject.assurance, accepted.authorization);
      return this.authRedirect('/membership', accepted.transaction.target, { state: 'selectionrequired' }, this.cookies.preauth(preauth.token));
    }
    const issued = await this.sessions.issue(database, {
      principal: resolution.principal,
      membership: candidates[0]!.id,
      assurance: subject.assurance,
      target: accepted.transaction.target,
      device: context.device,
      peer: context.peer,
      agent: context.agent,
      trace: context.trace,
    });
    await this.repository.complete(database, accepted.transaction.id, verified.version);
    return Object.freeze({ status: 303, headers: Object.freeze({ ...issued.headers, location: this.returns.issue(accepted.transaction.target).url, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }) });
  }

  private authRedirect(path: string, target: 'console' | 'storefront', query: Readonly<Record<string, string>>, cookie?: string): OperationResult {
    const location = new URL(path, `${IDENTITY_PROVIDER_CONFIGURATION.callbackBases[0]}/`);
    location.searchParams.set('target', target);
    for (const [key, value] of Object.entries(query)) location.searchParams.set(key, value);
    return Object.freeze({ status: 303, headers: Object.freeze({ location: location.toString(), ...(cookie ? { 'set-cookie': cookie } : {}), 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' }) });
  }
}
