import { nodeTelemetry, type Telemetry } from '@shop/telemetry';
import { token } from '../../bootstrap/Container';

export const TELEMETRY = token<Telemetry>('telemetry');

export function commerceTelemetry(): Telemetry {
  return nodeTelemetry((record) => {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  });
}
