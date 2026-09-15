# RV0062｜GX-0040 Reporting Cockpit 跨域汇总函数

- 复核对象：`20260821077000_add_reporting_cockpit.sql`、`20260912130000_create_supplier_analytics_perspective.sql`、Reporting repository 与 Dashboard operation。
- 直接证据：初始一参 `reporting.cockpit` 是 stable/security-invoker，按组织后代、reporting fact、catalog、inventory、ordering 汇总，禁止 public 执行；Repository 当前调用三参 overload，Dashboard 的 AccessPipeline 已先解析并固定 `access.scope.id`。
- overload 差异：三参 supplier 视图只在 supplier id、scope、kind、active 状态匹配时汇总；supplier 为空或不匹配时显式回退 `reporting.cockpit(p_scope)`，因此不是可删除的重复实现。它以 definer/`row_security=off` 聚合跨域数据，execute 仅授予内部 API/Job 角色。
- 结论：GX-0040 维持。函数承担跨域 read model 和历史兼容责任；不可删除、改写或单独重放。definer/RLS-off 的执行角色最小化及生产权限仍需专项持续复核；本次未发现已证实的 P0/P1，未执行迁移、测试或线上操作。
