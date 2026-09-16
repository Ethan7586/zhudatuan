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

The retired Seal, Closure, Lease, runner-routing and prepared-deploy engine has been removed. Recovery uses the same target `current/previous` truth as Runner 1.6; the remaining legacy OSS workflow is an explicitly isolated last resort and is not a deployment authority.
