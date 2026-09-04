import { useCallback, useSyncExternalStore } from 'react';
import type { PreferenceAddress, PreferenceCodec } from './Preference';
import type { PreferencePort } from './PreferencePort';

export function usePreference<Value>(port: PreferencePort, address: PreferenceAddress, codec: PreferenceCodec<Value>): readonly [Value, (value: Value) => void] {
  const subscribe = useCallback((listener: () => void) => port.subscribe(address, listener), [address, port]);
  const read = useCallback(() => port.read(address, codec), [address, codec, port]);
  const value = useSyncExternalStore(subscribe, read, () => codec.fallback);
  const write = useCallback((next: Value) => port.write(address, codec, next), [address, codec, port]);
  return Object.freeze([value, write]);
}
