import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { RiskCaseCommand, RiskPolicyCommand } from '../model/Command';
import type { RiskPage, RiskReceipt } from '../model/Risk';

export interface RiskPort {
  read(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<RiskPage>;
  managePolicy(context: ConsoleContext, command: RiskPolicyCommand, signal?: AbortSignal): Promise<RiskReceipt>;
  reviewCase(context: ConsoleContext, command: RiskCaseCommand, signal?: AbortSignal): Promise<RiskReceipt>;
  createIdentity(): string;
  createReference(): string;
}
