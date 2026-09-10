const commerceRoot = 'services/commerce/src/entry';

export const COMMERCE_ENTRY_POINTS = Object.freeze({
  ApiMain: `${commerceRoot}/ApiMain.ts`,
  JobsMain: `${commerceRoot}/JobsMain.ts`,
  ProviderMain: `${commerceRoot}/ProviderMain.ts`,
  ProviderCatalogMain: `${commerceRoot}/ProviderCatalogMain.ts`,
  MigrationMain: `${commerceRoot}/MigrationMain.ts`,
  SmokeMain: `${commerceRoot}/SmokeMain.ts`,
});

export const TOOL_ENTRY_POINTS = Object.freeze({
  SecretStoreMain: 'tools/localsecrets/src/Main.ts',
  KmsMain: 'tools/localkms/src/Main.ts',
  ObjectMain: 'tools/localobjects/src/Main.ts',
  SeedMain: 'tools/seed/src/Seed.ts',
  JourneyMain: 'tools/seed/src/Journey.ts',
  VisualMain: 'tools/seed/src/Visual.ts',
  VerifyMain: 'tools/seed/src/Verify.ts',
  AcceptanceOtpMain: 'tools/seed/src/AcceptanceOtp.mts',
});

export const BUNDLED_ENTRY_POINTS = Object.freeze({ ...COMMERCE_ENTRY_POINTS, ...TOOL_ENTRY_POINTS });

export const COMMERCE_ENTRY_FILES = Object.freeze(Object.values(COMMERCE_ENTRY_POINTS).map((path) => path.split('/').at(-1)).sort());
export const BUNDLED_ENTRY_FILES = Object.freeze(Object.keys(BUNDLED_ENTRY_POINTS).map((name) => `${name}.js`).sort());
