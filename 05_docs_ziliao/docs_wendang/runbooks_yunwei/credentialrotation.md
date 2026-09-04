# Credential rotation

## Trigger and impact

Trigger on scheduled expiry, suspected exposure, provider revocation or workbook/history discovery. Security owner coordinates workload/provider owner.

## Stop loss and diagnosis

Revoke compromised credential where safe, disable affected connection, and search logs/artifacts/backups without printing values. Identify consumers by secret reference/version.

## Recovery and data repair

Create new secret-manager version under dual approval, canary health/signature, atomically activate reference and confirm old value is invalid.

## Validation and escalation

All consumers use new version, old authentication fails, no secret appears in DB/log/bundle, alerts and expiry are active. Suspected use triggers security incident response.

## Audit and postmortem

Record only references, versions, owners, times and verification—not secret values. Document exposure path and control action.
