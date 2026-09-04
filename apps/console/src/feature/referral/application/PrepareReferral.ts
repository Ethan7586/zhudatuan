import { createActionRequest } from '../../../shared/security/ActionRequest';
import type { ReferralActionValues } from '../model/Referral';
import { createReferralCommand } from '../model/ReferralOperation';

export class PrepareReferral {
  execute(values: ReferralActionValues, makerMembership: string): Promise<string> {
    const command = createReferralCommand(values);
    return createActionRequest(command.operation, command.input, command.expectedVersion, makerMembership);
  }
}
