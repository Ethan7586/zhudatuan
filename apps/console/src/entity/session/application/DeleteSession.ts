import type { SessionCommandContext } from '../model/Stepup';
import type { SessionPort } from '../public/SessionPort';

export class DeleteSession {
  public constructor(private readonly port: SessionPort) {}
  public execute(context: SessionCommandContext): Promise<unknown> {
    return this.port.delete(context);
  }
}
