const IDENTITY_RUNTIME_ENTRIES = Object.freeze([
  '04_tools/tools/localsecrets/src/Main.ts',
  '04_tools/tools/localkms/src/Main.ts',
]);

const FULL_RUNTIME_ENTRIES = Object.freeze([
  ...IDENTITY_RUNTIME_ENTRIES,
  '04_tools/tools/localobjects/src/Main.ts',
]);

export function localRuntimeEntries(profile: string | undefined): readonly string[] {
  return profile === 'registration-only' ? IDENTITY_RUNTIME_ENTRIES : FULL_RUNTIME_ENTRIES;
}
