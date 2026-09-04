import type { SessionCommandContext } from '../model/Stepup';
import type { SessionPort } from '../public/SessionPort';

export class DisableStepup {
  public constructor(private readonly port: SessionPort) {}
  public async execute(context: SessionCommandContext): Promise<void> {
    const result = await this.port.disableStepup(context);
    if (result.assurance > 2) throw new Error('STEPUP_DISABLE_INVALID');
  }
}
