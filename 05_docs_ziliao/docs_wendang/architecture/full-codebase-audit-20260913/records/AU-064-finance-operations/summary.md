# AU-064｜finance 结算、对账、提现、发票与后台任务深审

- 本单元覆盖 reconciliation job 的 event/statement 分流、对账文件 hash/CSV/匹配、结算 frozen basis、伙伴与 referral 提现、支付网关幂等键、发票签发与对象存储、以及财务 deadletter。
- Settlement 将 reconciliation、statement、匹配项、policy 和 line snapshot 锁定/冻结后才建 settlement；PGlite 测试覆盖退款净额、late payment 排除、时区会计时刻、不可变 settlement line 和同 job replay。提现向 provider 传 withdrawal id 作为 HTTP idempotency key；paid 后才在同一事务过账并更新 withdrawal/settlement/outbox。
- 对账在 hash 通过后批量写 statementline、按优先级匹配内部事实并形成 difference；发票先切换 issuing、解密 PII、签发/上传，最后事务写 document/request/status/outbox；deadletter 分别将提现标 uncertain、对账标 difference、发票标 failed。
- 新增 F-0151/P2：对账、发票和 finance deadletter 的真实行为/失败恢复没有模块专用测试。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0/P1。
