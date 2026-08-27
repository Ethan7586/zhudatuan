# Statement sync

- Trigger: provider statement missing after period close, checksum mismatch, or dead letter.
- Impact: reconciliation, settlement and invoices for the affected partner remain blocked.
- Owner: Finance on-call with Channel owner.
- Stop loss: hold settlement and invoice issuance for the partner/period.
- Diagnosis: inspect statement cursor, object hash, period/timezone, provider operations and reconciliation state.
- Recovery: query provider, re-download to a new immutable object version, verify hash, and replay the same job.
- Data repair: retain both objects and create an adjustment workflow; never replace closed-period entries.
- Validation: statement count/amount match, journal remains balanced, and reconciliation reaches an explicit state.
- Escalation: finance controller immediately for amount mismatch; provider owner for delivery failure.
- Audit: record object reference/hash, period, replay reason and approvals.
- Postmortem: include settlement exposure and control improvement.
