import { InappClient } from './Client';
import { parseInappConfiguration, type InappConfiguration } from './Config';

export class InappFactory {
  static create(configuration: unknown = {}): InappClient {
    return new InappClient(parseInappConfiguration(configuration as InappConfiguration));
  }
}
