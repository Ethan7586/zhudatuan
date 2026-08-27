# Order expiry

- Trigger: unpaid orders exceed configured expiry, expiry lag exceeds 30 seconds, or late-payment alert fires.
- Impact: stock and benefit holds may remain occupied; a late payment may require automatic refund.
- Owner: Order on-call with Payment and Inventory owners.
- Stop loss: pause expiry only for the affected scope; never cancel an order before querying pending payment.
- Diagnosis: inspect checkout expiry, order/payment state, provider query, holds, job attempts and event order.
- Recovery: query payment, then atomically close unpaid orders and release holds; route captured late payments to refund.
- Data repair: replay state events and compensation jobs by original business key.
- Validation: order, payment, inventory, benefit and finance states reconcile with no duplicate release.
- Escalation: P0 for captured payment on fulfilled/cancelled inconsistency.
- Audit: store query evidence, transition reason and compensation IDs.
- Postmortem: document race ordering and timeout-policy action.
