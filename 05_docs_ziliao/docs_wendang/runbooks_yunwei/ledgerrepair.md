# Ledger repair

## Trigger and impact

Trigger whenever journal debit differs from credit, balances disagree with entries, or reconciliation exposes an unexplained amount. Owner: Finance controller.

## Stop loss and diagnosis

Block settlement, withdrawal and invoice for affected scope/period. Compare immutable journals/entries to payment, refund, voucher, benefit and provider statement business keys.

## Recovery and data repair

Post a dual-approved adjustment journal referencing original entries; never update or delete a posted entry or closed period.

## Validation and escalation

Every journal balances, account balances equal ordered entry sums, provider count/amount reconciles, and adjustment approval is distinct from requester. Any imbalance is P0.

## Audit and postmortem

Archive discrepancy calculation, statement hash, approvals, adjustment IDs, exposure and control action.
