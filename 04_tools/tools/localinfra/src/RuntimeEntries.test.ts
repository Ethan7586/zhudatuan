import { describe, expect, it } from 'vitest';
import { localRuntimeEntries } from './RuntimeEntries';

describe('localRuntimeEntries', () => {
  it('starts only the identity secret services for the production registration profile', () => {
    expect(localRuntimeEntries('registration-only')).toEqual([
      '04_tools/tools/localsecrets/src/Main.ts',
      '04_tools/tools/localkms/src/Main.ts',
    ]);
  });

  it.each([undefined, 'full-staging'])('keeps the complete local runtime for profile %s', profile => {
    expect(localRuntimeEntries(profile)).toEqual([
      '04_tools/tools/localsecrets/src/Main.ts',
      '04_tools/tools/localkms/src/Main.ts',
      '04_tools/tools/localobjects/src/Main.ts',
    ]);
  });
});
