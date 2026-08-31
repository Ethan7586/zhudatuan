# Identity Provider Health

Owner: Identity. Runtime queue, concurrency, timeout, retry and lease values come exclusively from the `providerhealth` entry in `JOB_CATALOG`.

## Trigger and impact

Trigger an incident when one Provider remains unavailable across the configured threshold, latency or circuit-open rates rise, probes dead-letter, or a fixed endpoint/algorithm policy is rejected. Impact is isolated to that Provider; password/OTP and other healthy Providers remain available.

## Stop loss and diagnosis

Do not relax endpoint allowlists, TLS, DNS/IP checks, algorithm policy, deadline, response-size limits or Secret references. An unavailable Provider degrades only that Provider, and the health job itself must not disable Provider configuration. Inspect stable error codes, status transitions, latency, circuit state, clock skew, fixed endpoint reachability, JWKS/token health and Secret resolution. Never store or log issuer details, tenant/client identifiers, token values or Secret references.

## Recovery and data repair

Restore the fixed endpoint, Secret version, trusted clock or approved Provider configuration, then let the bounded half-open probe recover the circuit. Provider-health data repair is forward-only: correct only invalid health rows with a reviewed idempotent job while preserving transition history; never fabricate healthy state or edit federated identities.

## Validation and escalation

Validate two consecutive successful probes, bounded latency, closed circuit state and a real authentication Sandbox journey before enabling the Provider. Escalate TLS/DNS policy violations, unexpected issuer/algorithm changes, credential disclosure or cross-tenant results to Identity and Security.

## Audit and postmortem

Preserve job/trace IDs, Provider type, hashed instance ID, configuration version, stable error code, aggregate latency, schema/release heads and immutable audit references. The postmortem records trigger, impact, stop loss, diagnosis, recovery, validation, root cause, prevention, owners and due dates without identifiers or credentials.
