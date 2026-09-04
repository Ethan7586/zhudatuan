import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReferralActionValues } from '../model/Referral';
import type { ReferralPort } from '../public';
import { executeReferral } from './ExecuteReferral';

export class ManageProduct {
  constructor(private readonly port: Pick<ReferralPort, 'execute'>) {}
  execute(context: ConsoleContext, values: ReferralActionValues & Readonly<{ action: Extract<ReferralActionValues['action'], { kind: 'product' }> }>, proof: string, identity: string, signal?: AbortSignal) {
    return executeReferral(this.port, context, values, proof, identity, signal);
  }
}
