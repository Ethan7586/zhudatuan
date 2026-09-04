import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchRisk, type RiskOperations } from '@shop/sdk/risk';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { RiskCaseCommand, RiskPolicyCommand } from '../model/Command';
import type { RiskPort } from '../public';
import { RiskMapper } from './RiskMapper';

export class RiskGateway implements RiskPort {
  private readonly client: RiskOperations;
  private readonly mapper = new RiskMapper();
  constructor(baseUrl: string) {
    this.client = createFetchRisk(baseUrl);
  }

  async read(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.client.centerRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.page(value);
  }

  async managePolicy(context: ConsoleContext, command: RiskPolicyCommand, signal?: AbortSignal) {
    const body = policyBody(command);
    const value = await this.client.policiesManage({ path: { policyid: command.policy }, body }, commandContext(context, command, signal));
    return this.mapper.policyReceipt(value, command.action);
  }

  async reviewCase(context: ConsoleContext, command: RiskCaseCommand, signal?: AbortSignal) {
    const value = await this.client.casesReview({ path: { caseid: command.case }, body: { action: command.action, reason: command.reason, evidence: command.evidence } }, commandContext(context, command, signal));
    return this.mapper.caseReceipt(value, command.action);
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
  createReference(): string {
    return `riskpolicy:${crypto.randomUUID()}`;
  }
}

function policyBody(command: RiskPolicyCommand) {
  if (command.action === 'save') return { action: command.action, name: command.name, rule: command.rule, rolloutPercent: command.rolloutPercent } as const;
  if (command.action === 'activate') return { action: command.action, version: command.version, rolloutPercent: command.rolloutPercent } as const;
  return { action: command.action } as const;
}

function commandContext(context: ConsoleContext, command: Readonly<{ expectedVersion: number; proof: string; identity: string }>, signal?: AbortSignal) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion: command.expectedVersion,
    proof: command.proof,
    idempotencyKey: command.identity,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}
