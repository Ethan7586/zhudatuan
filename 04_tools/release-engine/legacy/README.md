# Legacy and recovery boundary

`cli.mjs`, `src/engine.mjs` and their older support modules remain only because `RECOVERY.md` still references direct historical repair operations. Runner 1.6 does not import or invoke them.

The normal release path is limited to:

- `runner-1-6.mjs`
- `src/build-core-1-6.mjs`
- `src/simple-artifact-store.mjs`
- `src/runner-selection-1-6.mjs`
- `scripts/runner-1-6.sh`
- `.github/workflows/delivery-1-6.yml`

Seal, Closure, Runner Lease, Writer Lease, Doctor, Reconcile and orchestration code in the legacy engine has no authority over Runner 1.6 and must not be called from the normal workflow.
