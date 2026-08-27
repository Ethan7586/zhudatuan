import { createTelemetry } from './Adapter';

interface BeaconNavigator {
  readonly sendBeacon: (url: string, data: Blob) => boolean;
}

export function browserTelemetry(endpoint: string) {
  if (!endpoint.startsWith('https://')) throw new Error('TELEMETRY_ENDPOINT_INVALID');
  return createTelemetry((record) => {
    const body = JSON.stringify(record);
    const candidate: unknown = globalThis.navigator;
    if (isBeaconNavigator(candidate)) {
      candidate.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    }
  });
}

function isBeaconNavigator(value: unknown): value is BeaconNavigator {
  return typeof value === 'object' && value !== null && 'sendBeacon' in value && typeof value.sendBeacon === 'function';
}
