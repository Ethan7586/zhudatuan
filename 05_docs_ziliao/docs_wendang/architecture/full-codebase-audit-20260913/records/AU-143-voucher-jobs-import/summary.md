# AU-143｜Voucher 导入、发券、状态 Worker 与死信深审

Voucher public adapter owns checkout/order/payment voucher reservations, consumption, refunds and store verification. Imported card libraries are encrypted in 500-row shards, processed with per-row savepoints, then report/complete or reject/fault. Issue, expiry and status processors use row locks/skip locked, bounded chunks, durable continuation jobs, status events, finance postings and outbox facts. Voucher deadletter returns failed batches/imports/status work to explicit terminal state and emits a matching failure event.

新增 F-0177/P2：未见 VoucherPort、PgVoucherImport、VoucherJobProcessor 或 VoucherDeadletter 的直接行为测试；唯一跨模块 VoucherPort instance 使用空 voucher selection，不能验证 reserve/consume/refund/verification、encryption/import continuation、issue/status/expiry retry/rollback 或 deadletter release。未发现 P0/P1；测试执行未验证（审计 worktree 缺少 Vitest）。
