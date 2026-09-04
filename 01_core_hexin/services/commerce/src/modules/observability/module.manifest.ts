import { defineModuleManifest } from '@shop/kernel';

/** Observability-owned, process-lived platform entrypoint. Its adapter is replaceable; business state ownership is forbidden. */
export const observabilityManifest = defineModuleManifest({
  id: 'observability',
  version: '1.0.0',
  kind: 'platform',
  provides: [],
  requires: [],
  operations: [
    'observability.clienterrors.create',
    'observability.clienterrors.read',
  ],
  publishes: [],
  consumes: [],
  publicEntry: './index.ts',
  layers: ['public', 'interface', 'tests'],
  entrypoints: {
    http: ['ObservabilityModule'],
    jobs: [],
  },
});
