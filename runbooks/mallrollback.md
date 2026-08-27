# Mall experience rollback

## Trigger and impact

Trigger on published experience validation failure, broken action/asset/domain, or severe client regression. Experience owner leads.

## Stop loss and diagnosis

Stop new publication for the mall; preserve immutable published version, CDN hash and client traces. Compare Web/Miniapp/CDN version/action registry.

## Recovery and data repair

Restore by creating and publishing a new version referencing the last known-good immutable configuration; never mutate the old release.

## Validation and escalation

Web, Miniapp and CDN return the same version/hash, all actions are registered/authorized, assets load and checkout smoke passes. Escalate security/domain-binding failures.

## Audit and postmortem

Record triggering version, restored source version, actor, reason, hashes, affected sessions and prevention action.
