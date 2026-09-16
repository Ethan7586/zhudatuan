# AU-511｜管理员上下文解析测试

- 审阅范围：`01_core_hexin/services/commerce/src/foundation/security/AdministratorContextResolver.test.ts`（41 行）；定向追踪实现及 AdministratorSegmentOperations consumers。
- 审阅方式：逐段人工阅读与静态调用追踪；未连接数据库。

## 真实运行关系

Console actor → `access.resolve_administrator_context(membership)` → resolver 将 active membership、account、principal、realm、access version 与数据库行逐项对比 → immutable administrator segment scope → AdministratorSegmentOperations 的 list/detail/member write。非 console、缺 account/realm、空/多行、任一身份或版本不一致均 fail-fast。

## 审计结论

- **G0**：该测试保存 administrator 不是由普通 member session 或别 realm membership 推断出来的关键契约；resolver 的 identity/version/segment scope 验证由实际管理员操作调用，不能删除。
- 实现额外验证正整数 identity/scope/access version 和有效时间戳，并复制冻结 role/permission arrays，降低 DB driver 类型与后续 mutation 影响；测试未穷尽这些异常路径，但没有静态反例。

## 未验证项

- 未执行 `access.resolve_administrator_context`，未验证其 SQL、RLS、role assignment 与多行故障在真实数据库中的行为；这需在 access/管理员迁移专项中完成。
