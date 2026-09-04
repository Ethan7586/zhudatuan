# Support SLA

- Trigger: response/resolution deadline is reached, escalation lag grows or dead letter appears.
- Impact: customer cases miss promised service level.
- Owner: Support on-call and queue supervisor.
- Stop loss: manually assign urgent cases while preserving automatic assignment evidence.
- Diagnosis: inspect case priority, SLA snapshot, assignment, agent availability, escalation and attempts.
- Recovery: replay case ID; idempotent escalation creates one event/notification.
- Data repair: append corrected SLA/assignment event with reason, never rewrite conversation history.
- Validation: overdue cases have one escalation, owner and notification; timers use case policy version.
- Escalation: support manager immediately for urgent cases.
- Audit: record timer, policy, assignee, reason and manual action.
- Postmortem: include queue capacity and routing change.
