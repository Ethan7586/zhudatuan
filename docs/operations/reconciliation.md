# Reconciliation

- Trigger: amount/count difference, unbalanced journal, missing statement or dead letter.
- Impact: settlement, withdrawal and invoice release are blocked.
- Owner: Finance on-call and finance controller.
- Stop loss: close the affected period to new settlement actions and preserve all raw evidence.
- Diagnosis: compare normalized immutable statement lines with payment Attempt external transaction, refund provider reference, fulfillment external reference, voucher/benefit journals and other journals by business key.
- Recovery: verify the source Object hash, restore the reconciliation to matching, and rerun deterministic set-based matching; never edit a normalized statement line in place.
- Data repair: post approved adjustment journals; never mutate closed entries.
- Validation: debit equals credit, provider and internal amount/count match, and every difference has disposition.
- Escalation: P0 for ledger imbalance; controller approval for any adjustment.
- Audit: retain object hash, rule version, approver and adjustment references.
- Postmortem: document root cause, financial exposure and control owner.
