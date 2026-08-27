# Risk scan

- Trigger: policy replay stalls, decision volume deviates, auto-listing proposal fails or dead letter appears.
- Impact: suspicious operations may require manual review; Risk never writes catalog state directly.
- Owner: Risk on-call with affected domain owner.
- Stop loss: disable the policy version and challenge/review affected operations; do not silently allow.
- Diagnosis: inspect signals, policy version, sampled decisions, replay cursor and proposal output.
- Recovery: correct and approve a new policy version, replay samples, then canary activation.
- Data repair: append superseding decisions/proposals; do not erase prior evidence.
- Validation: expected allow/challenge/review/deny distribution, no cross-scope signals and approved catalog commands only.
- Escalation: security for suspected abuse; catalog owner for listing impact.
- Audit: retain policy hash, approvers, signals and canary result.
- Postmortem: document false-positive/negative evidence and rule action.
