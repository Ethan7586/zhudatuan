import { OP_REFERRAL_MEMBERS_APPROVE, OP_REFERRAL_PRODUCTS_MANAGE, OP_REFERRAL_SETTINGS_MANAGE } from '@shop/contract/ids';
import { createFetchReferral, type ReferralOperations } from '@shop/sdk/referral';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import { REFERRAL_PAGE_LIMIT, type ReferralSection } from '../model/Referral';
import type { ReferralCommand } from '../model/ReferralOperation';
import type { ReferralPort } from '../public';
import { ReferralMapper } from './ReferralMapper';

export class ReferralGateway implements ReferralPort {
  private readonly operations: ReferralOperations;
  private readonly mapper = new ReferralMapper();

  constructor(baseUrl: string) {
    this.operations = createFetchReferral(baseUrl);
  }

  async read(context: ConsoleContext, section: ReferralSection, cursor?: string, signal?: AbortSignal) {
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    const input = { query: { limit: REFERRAL_PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) } };
    if (section === 'settings') return this.mapper.settings(await this.operations.settingsRead({}, request));
    if (section === 'product') return this.mapper.products(await this.operations.productsRead(input, request));
    if (section === 'review') return this.mapper.members(await this.operations.membersRead(input, request));
    if (section === 'binding') return this.mapper.bindings(await this.operations.bindingsRead(input, request));
    if (section === 'withdrawal') return this.mapper.withdrawals(await this.operations.withdrawalsRead(input, request));
    return this.mapper.commissions(await this.operations.commissionsRead(input, request));
  }

  async execute(context: ConsoleContext, command: ReferralCommand, proof: string, identity: string, signal?: AbortSignal): Promise<void> {
    const request = consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: command.expectedVersion,
      proof,
      idempotencyKey: identity,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    });
    if (command.operation === OP_REFERRAL_SETTINGS_MANAGE) {
      await this.operations.settingsManage(command.input as Parameters<ReferralOperations['settingsManage']>[0], request);
      return;
    }
    if (command.operation === OP_REFERRAL_PRODUCTS_MANAGE) {
      await this.operations.productsManage(command.input as Parameters<ReferralOperations['productsManage']>[0], request);
      return;
    }
    const operation = command.operation === OP_REFERRAL_MEMBERS_APPROVE ? this.operations.membersApprove : this.operations.membersDisqualify;
    await operation(command.input as Parameters<typeof operation>[0], request);
  }
}
