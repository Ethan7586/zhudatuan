# AU-010 历史取证

## 1. 语义来源

- `Policy.ts` 的有效期、containment 和 step-up 主体来自 2026-08-27 基线提交；`contains` 的 platform、self/owner、tenant 和 ancestor 分支最后语义修改也停留在 2026-08-27。
- `PermissionCatalog.ts` 的共享 `all/operator/scoped` 数组、浅冻结 definition、`byCode` 和重复 code 检查同样来自 2026-08-27。
- 包随后经历目录整合与基线收口，但固定基线的核心判定分支没有证据显示经过针对异常 scope、共享数组 mutation 或二级 permission 调用约束的专项修订。

## 2. 接缝漂移

- `PgScopeResolver` 在提交 `68bcc538`（2026-09-12，绑定会话 Membership 的权限读取边界）改为要求 membership consumption context，并调用 `access.resolve_session_scope` 七参数接口。
- `WebBusinessScopeResolver.test.ts:50-59` 的用例主体来自 2026-08-31/09-03，仍期待旧 `access.resolve_scope` 与四参数数组。历史顺序与实际探针共同证明这是测试未随接口迁移，而不是根据提交标题猜测。
- `AccessOperations` 的角色/范围管理和后续治理迁移多次演进；当前固定基线仍以普通 permission code 数组重建 custom role，并只按特定内建 role ID 施加 Owner 特例。旧 handoff 文档指出 permission subset 风险，只作为线索；最终 F-0053 以现行 UI、handler、SQL 投影和调用链为证据。

## 3. 基线后历史

`git log --all` 可见固定基线之后其它分支出现 Authz/角色权限清理提交。按审计协议，本 AU 不读取其结果作为当前基线事实，不把它 merge/rebase 进审计分支，也不据此宣称问题已修复。若未来主线已移除或替换本包，只能在全仓审计完成后建立增量审计，重新验证调用链、数据责任、兼容和可观察行为。

## 4. 历史不能证明的事项

- 提交标题不能证明线上数据库已应用对应 migration。
- 旧文档中的 P0/P1 标签不能替代本审计严重度；本次没有线上事故证据。
- 后续分支删除某文件不能证明固定基线对象是垃圾，也不能关闭 DC-0012 或本 AU findings。
