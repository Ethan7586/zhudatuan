# Runner 1.7 release engine

The normal release implementation is intentionally small:

```text
runner-1-6.mjs
├── build-core-1-6.mjs
├── simple-artifact-store.mjs
├── oss-client-1-6.mjs
└── remote/agent.mjs
```

`delivery-1-6.yml` chooses an execution location. Aliyun and GitHub Hosted both invoke the same composite action and `scripts/runner-1-6.sh`; runner selection does not create stored routing state.

The normal path calculates affected targets, reuses or rebuilds ordinary OSS artifacts, deploys them with the existing direct remote action, waits for real health, and reports the target's `current/previous` state. OSS is storage, not a deployment authority.

An exact `release` or `retry` with both target and physical node limits work to that target and node. On a cache hit it skips dependency installation, tests, and build; on a cache miss it prepares the target's immutable artifact in the same shared core before deploying. The target verifies the artifact, atomically updates `current/previous`, restarts, checks health, and automatically restores the prior version after a health failure. The 60-second objective applies to the entire user-command-to-healthy-target interval, not just cutover; the observation is not a gate.

The core installs its own minimal dependencies and the selected source workspaces concurrently. Missing or unusable cache objects are rebuilt normally. Control checkout is sparse; exact commerce targets use a narrower Source checkout that retains their build/test inputs, while other targets keep full Source checkout. Progress and final receipts expose preparation stages and elapsed time; they do not promote OSS or a local cache to production authority. The GitHub workflow filename, composite action path, and machine-readable receipt prefix retain their 1.6 spellings solely for compatibility; there is only one active 1.7 implementation.

The remote core has no global or directory lock and no unlock state. Atomic pointers provide the target truth. A superseded invocation cannot restore over a newer `current` pointer.

The retired Seal, Closure, Lease, runner-routing and prepared-deploy engine has been removed. Recovery uses the same target `current/previous` truth as Runner 1.7; the remaining legacy OSS workflow is an explicitly isolated last resort and is not a deployment authority.
