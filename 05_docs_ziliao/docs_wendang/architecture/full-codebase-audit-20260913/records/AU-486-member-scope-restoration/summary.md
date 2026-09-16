# AU-486｜成员范围授权恢复

- 主审 `20260821080000_restore_member_scope_authorization.sql`（61 行），并人工反查 AU-476 的前序函数、member/benefit/voucher 查询消费者和之后的 scope function 定义；未执行迁移、数据库查询或线上验证。
- 本迁移明确承认 AU-476 门店管理重定义 `access.scope_allowed` 时移除了 member→organization path，并恢复 active membership 对自身 member、所属组织和组织子树的 scope 访问，同时保留 operator 的组织/partner 子树能力。
- 迁移设置 membership/member context 后断言自身与组织均可通过、无关 scope 必须拒绝。当前大量业务 SQL 仍以 `access.scope_allowed` 作为读取或更新前的范围门槛；因此缺陷会将部分 member 路径错误拒绝，而不是扩大到任意无关 scope。
- **F-0242/P2**：已修复的 member scope authorization 回归，证据见 `04-findings.md`。**G0**：当前成员自身/商城范围功能依赖恢复后的函数。归并至 **GX-0032**（scope function 与门店/成员授权演进）；禁止删除、改写、跳过或单独重放。未发现 P0；未验证历史上线窗口、真实受影响请求、实际数据库函数和完整恢复演练。
