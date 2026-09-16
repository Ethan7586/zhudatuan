# Runner 1.6 release engine

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

An exact `release` or `retry` with both target and physical node is the 1.3-style fast cutover path. It does not install dependencies, plan impact, test, or build. It requires the immutable artifact to exist, then performs artifact verification, atomic `current/previous` pointer updates, restart, health verification, and automatic restoration. Its production duration is reported against a 60-second objective; the observation is not a gate.

The remote core has no global or directory lock and no unlock state. Atomic pointers provide the target truth. A superseded invocation cannot restore over a newer `current` pointer.

The retired Seal, Closure, Lease, runner-routing and prepared-deploy engine has been removed. Recovery uses the same target `current/previous` truth as Runner 1.6; the remaining legacy OSS workflow is an explicitly isolated last resort and is not a deployment authority.
