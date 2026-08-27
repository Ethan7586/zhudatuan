import { build } from 'esbuild';

await build({
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  bundle: true,
<<<<<<< HEAD
  entryPoints: {
    ApiMain: 'services/commerce/src/entry/ApiMain.ts',
    IdentityRegistrationApiMain: 'services/commerce/src/entry/IdentityRegistrationApiMain.ts',
    IdentityRegistrationApiReadyMain: 'services/commerce/src/entry/IdentityRegistrationApiReadyMain.ts',
    WebBusinessApiMain: 'services/commerce/src/entry/WebBusinessApiMain.ts',
    WebBusinessApiReadyMain: 'services/commerce/src/entry/WebBusinessApiReadyMain.ts',
    PurchaseApiMain: 'services/commerce/src/entry/PurchaseApiMain.ts',
    PurchaseApiReadyMain: 'services/commerce/src/entry/PurchaseApiReadyMain.ts',
    JobsMain: 'services/commerce/src/entry/JobsMain.ts',
    IdentityNotificationJobsOnlyMain: 'services/commerce/src/entry/IdentityNotificationJobsOnlyMain.ts',
    IdentityNotificationJobsReadyMain: 'services/commerce/src/entry/IdentityNotificationJobsReadyMain.ts',
    MigrationMain: 'services/commerce/src/entry/MigrationMain.ts',
    RegistrationMigrationMain: 'services/commerce/src/entry/RegistrationMigrationMain.ts',
    SmokeMain: 'services/commerce/src/entry/SmokeMain.ts',
    LocalSecretsMain: 'tools/localsecrets/src/Main.ts',
    LocalKmsMain: 'tools/localkms/src/Main.ts',
    LocalObjectsMain: 'tools/localobjects/src/Main.ts',
    InternalRuntimeMain: 'tools/localinfra/src/Run.ts',
    InternalRuntimeReadyMain: 'tools/localinfra/src/RegistrationReady.ts',
    PostgresTlsProxyMain: 'tools/localinfra/src/PostgresTlsProxyMain.ts',
    BootstrapRegistration: 'tools/seed/src/BootstrapRegistration.ts',
    BootstrapOwner: 'tools/seed/src/BootstrapOwner.ts',
    BootstrapStagingOwner: 'tools/seed/src/BootstrapStagingOwner.ts',
    StagingReadinessMain: 'infrastructure/zhudatuan/aliyun/staging/verify-readiness.mjs',
  },
=======
  entryPoints: [
    'services/commerce/src/entry/ApiMain.ts',
    'services/commerce/src/entry/JobsMain.ts',
    'services/commerce/src/entry/MigrationMain.ts',
    'services/commerce/src/entry/SmokeMain.ts',
  ],
  external: ['pg', 'redis'],
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  format: 'esm',
  outdir: 'services/commerce/dist',
  platform: 'node',
  sourcemap: true,
});
