import type { PreferenceAddress, PreferenceCodec } from './Preference';

export interface PreferencePort {
  read<Value>(address: PreferenceAddress, codec: PreferenceCodec<Value>): Value;
  write<Value>(address: PreferenceAddress, codec: PreferenceCodec<Value>, value: Value): void;
  subscribe(address: PreferenceAddress, listener: () => void): () => void;
}
