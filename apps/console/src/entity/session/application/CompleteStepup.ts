import type { SessionCommandContext, StepupResult } from '../model/Stepup';
import type { SessionPort } from '../public/SessionPort';

export class CompleteStepup {
  public constructor(private readonly port: SessionPort) {}
  public async execute(context: SessionCommandContext, challenge: string, code: string): Promise<StepupResult> {
    const result = await this.port.completeStepup(context, challenge, code);
    if (result.assurance < 3) throw new Error('STEPUP_ASSURANCE_INVALID');
    return result;
  }
}
