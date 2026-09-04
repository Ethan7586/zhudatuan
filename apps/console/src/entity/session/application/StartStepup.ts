import type { SessionCommandContext, StepupAction, StepupChallenge } from '../model/Stepup';
import type { SessionPort } from '../public/SessionPort';

export class StartStepup {
  public constructor(private readonly port: SessionPort) {}
  public async execute(context: SessionCommandContext, action?: StepupAction): Promise<StepupChallenge> {
    const result = await this.port.startStepup(context, action);
    if (result.actionBound !== (action !== undefined)) throw new Error('ACTION_REQUEST_BINDING_INVALID');
    return result;
  }
}
