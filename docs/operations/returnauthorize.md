# Return authorization

The fulfillment worker consumes `returnauthorize` once an after-sale review is approved. It reads the immutable Order after-sale snapshot through the Order Public Port, groups lines by completed fulfillment, creates idempotent Return and ReturnLine records, then advances the Order after-sale aggregate to `returning`.

Retries are safe because `(aftersale_id, fulfillment_id)` and `(return_id, order_line_id)` are unique. If the job reaches the dead-letter queue, inspect missing completed fulfillment lines or invalid Provider return policy evidence before replaying the same job ID.
