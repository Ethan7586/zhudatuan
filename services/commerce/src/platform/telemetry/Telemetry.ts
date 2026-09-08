import { nodeTelemetry, type ObservableTelemetry, type ObservationReader, type Telemetry } from '@shop/telemetry';
import { token } from '../../composition/Container';

export const TELEMETRY = token<Telemetry>('telemetry');
export const OBSERVATIONS = token<ObservationReader>('telemetry.observations');

export function commerceTelemetry(): ObservableTelemetry {
  return nodeTelemetry((record) => {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  });
}
