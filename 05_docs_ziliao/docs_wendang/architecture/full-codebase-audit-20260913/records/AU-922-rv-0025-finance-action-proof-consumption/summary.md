# RV-0025｜财务动作凭证事务消费独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应首审：F-0243
- 结论：**确认 P1；未发现 P0。**
- 方法：从公开operation注册、访问管道、代表性财务命令和数据库单次消费函数重新追踪。

## 完整生产链

`finance.settlements.decide` → `FinanceRoutes` → `closeSettlementOperations.decide` → 数据库行锁、状态更新、可能的账务与事件。

此操作在`FinancialActionPolicy`的proof-required集合内。AccessPipeline接收`x-action-proof`、幂等键和版本头，但调用的`PgActionProofVerifier.validate()`只验证base64url样式，不读取数据库。

## 对照的设计实现

Mobile step-up会向`access.issue_action_proof`写入与actor、session、membership、scope、operation、resource、幂等键、版本和请求hash绑定的proof。数据库`access.consume_action_proof`可以原子核验所有绑定、未消费状态、期限、当前权限与step-up；`finance.assert_expected_version`可在同一事务锁定资源。

然而`consumeActionProof()`在生产源码的调用数为零，只有其自身单元测试；数据库函数也只由迁移和仓库测试直接调用。代表性`finance.settlements.decide`直接执行状态更新，不消费proof。

## 结论边界

持有既有操作权限的调用者可以提交任意格式合法的proof，以绕过该机制意图提供的step-up、请求绑定和一次性消费保护。常规capability、scope、业务职责分离和部分版本检查仍生效，但不足以替代该安全边界，因此确认P1。

没有访问线上服务、数据库、会话或审计记录；未发现正在发生的滥用或事故，故不是P0。后续修复必须从最新主线建立独立分支，将消费与版本断言接入每个受保护命令的同一事务，并覆盖伪造、过期、重放、跨资源、权限撤销和失败不写入的集成测试。
