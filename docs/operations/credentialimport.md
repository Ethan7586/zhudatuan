# Credential import

Owner: Voucher. Queue: `import`. Runtime verifies the object hash and stages 500-row chunks; Voucher validates, encrypts, and writes each row idempotently.

Use the generated error report for permanent row failures. Retry the same import for transient storage, KMS, or database failures. Do not attach the source file to incidents.
