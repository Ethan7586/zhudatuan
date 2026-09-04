# Extension health runbook

## Trigger and impact

`extensionhealth` continuously probes testing, enabled, and degraded installations. Repeated job failures make current health evidence stale; an unhealthy enabled installation is degraded and removed from subsequent operator trust decisions, while the last active registry instance remains available until an explicit atomic replacement or disable.

## Containment

1. Stop enabling the affected provider and scope.
2. Disable the connection when responses are unsafe; this atomically removes its active registry entry.
3. Do not edit installation, health, activation history, or job rows manually.

Stop loss: preserve the last active instance and health evidence while blocking new enablement for the affected provider and scope.

## Diagnosis

Correlate the job ID with `extension.health`, `extension.activationhistory`, `runtime.job`, `runtime.deadletter`, provider latency/error metrics, secret-store availability, TLS state, manifest version, and contract version. Confirm the signed manifest health operation equals the stored installation health operation.

## Recovery and data repair

Restore the referenced secret or provider endpoint, then invoke connection test. A healthy probe records version-bound evidence; enable stages a separate instance and atomically switches the registry only after the database commit. For corrupt configuration, disable and replace it through the channel API. Never manufacture healthy rows or rewrite history.

## Verification, escalation, and postmortem

Verify three consecutive healthy records, current contract/signature checks, bounded latency, a successful sandbox read, no new dead letters, and correct registry capability resolution. Escalate secret compromise to security and provider failure to the channel owner. Record timeline, blast radius, detection gap, failed invariant, corrective owner, and regression evidence in the postmortem.

Validation: attach the three probe records, manifest signature/contract result, sandbox request trace, latency bound, registry resolution and rollback check. Audit: record operator, reason, installation/version, secret reference version, activation history and final health state.
