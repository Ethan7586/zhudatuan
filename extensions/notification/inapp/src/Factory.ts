import { InappClient } from './Client';
import { parseInappConfiguration, type InappConfiguration } from './Config';

export class InappFactory {
  static create(configuration: unknown = {}): InappClient {
    parseInappConfiguration(configuration as InappConfiguration);
    return new InappClient();
  }
}
