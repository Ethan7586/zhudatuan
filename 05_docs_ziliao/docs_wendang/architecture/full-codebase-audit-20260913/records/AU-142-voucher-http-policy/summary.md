# AU-142｜Voucher HTTP operation、公共契约与状态策略深审

Voucher HTTP module owns card library allocation/import creation, program/reserve/batch/status/binding/redemption lifecycle and read projections. Access scope is applied in every SQL action; write paths use row locks, version guards, separation-of-duties on reserve decision, bounded batch inputs and queued workers. Identity operator exposes only five read actions. The public entry exports contracts/policy, not HTTP modules, workers or persistence.

新增 F-0176/P2：19 项 voucher HTTP operation 只有 manifest string 与 state-policy transition 测试，未见 action/repository/transaction fixture；权限 scope、expected-version、allocation reservation、approval separation、status/reversal 与 keyset behavior 无直接回归证明。未发现 P0/P1；测试执行未验证（审计 worktree 缺少 Vitest）。
