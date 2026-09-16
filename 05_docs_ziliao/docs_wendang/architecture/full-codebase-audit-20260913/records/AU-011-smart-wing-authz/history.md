# AU-011 历史取证

- `smart-wing-authz/src/index.ts` 与 `commerce-api/src/api/auth.ts` 的核心语义来自2026-08-27初始平台基线，固定基线内没有后续语义修改。
- 兼容数据库随后增加session-bound Membership解析、组织层级Scope、distributor anchor、角色permission ceiling与Scope授予上限；本AU以最新固定基线迁移定义为接缝事实，不以旧提交标题代替控制流。
- 当前release/delivery规则已把`commerce-api`和`admin-server.cjs`标为retired/forbidden，但workspace、手工build和源码仍保留。该状态说明“退出正式发布”，不证明“可以删除”。
- 固定基线之后其它分支的任何Authz变化均未merge/rebase进审计分支；后续主线只能另作增量审计。
