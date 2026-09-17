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

The normal path calculates affected targets, reuses or rebuilds ordinary OSS artifacts, deploys them with the existing direct remote action, runs configured health checks, and reports the target's `current/previous` state. Targets with no health checks report `not-checked`, not `ready`; this is an observation, not a new release gate. OSS is storage, not a deployment authority.

An exact `release` or `retry` with target/physical-node pairs limits work to those named placements. A single pair keeps the existing fast path. Multiple pairs use one workflow, one shared dependency install on a cache miss, and the same core; target ordering follows the existing `after` relationships, so a named database migration precedes a named service. A cache hit skips dependency installation, tests, and build; a cache miss prepares only the missing immutable artifacts before deploying. The target verifies the artifact, atomically updates `current/previous`, restarts, checks health, and automatically restores the prior version after a health failure. The 120-second objective applies to the entire user-command-to-healthy-target interval, not just cutover; the observation is not a gate.

After preparation and before the first target, that same core installs its matching remote Agent and policy once. A newly merged control plane therefore does not require a separate manual step before the next release, and exact remote-file hash equality is not a release gate. Actual remote hashes remain in the receipt. `status` remains read-only and reports an old Agent's `ready` with zero attempts and zero checks as `not-checked`; rollback remains available without a runtime sync.

The core installs its own minimal dependencies and the selected source build workspaces concurrently. Missing or unusable cache objects are rebuilt normally. Control checkout is sparse; exact commerce targets, including database migration, use a narrower Source checkout that retains their build/test inputs, while other targets keep full Source checkout. Progress and final receipts expose preparation stages and elapsed time; they do not promote OSS or a local cache to production authority. The GitHub workflow filename, composite action path, and machine-readable receipt prefix retain their 1.6 spellings solely for compatibility; there is only one active 1.7 implementation.

The remote core has no global or directory lock and no unlock state. Atomic pointers provide the target truth. A superseded invocation cannot restore over a newer `current` pointer.

The retired Seal, Closure, Lease, runner-routing and prepared-deploy engine has been removed. Recovery uses the same target `current/previous` truth as Runner 1.7; the remaining legacy OSS workflow is an explicitly isolated last resort and is not a deployment authority.
