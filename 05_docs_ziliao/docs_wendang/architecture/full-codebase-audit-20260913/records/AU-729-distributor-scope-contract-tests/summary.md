# AU-729｜分销商范围数据库合同测试

- 审阅范围：canonical distributor scope、distributor anchor authorization closure 与 distributor channel 的 3 份 SQL 合同。
- 审阅方式：深入审阅 canonical ID、membership scope、anchor、tenant 有效期、授权失效、中心查询与失败后状态不变；未运行 SQL。

## 审计结论

- **G0：全部保留。** 三份合同分别保存 canonical distributor ID 迁移、锚点授权闭环、以及 channel 生命周期与绑定边界；不属于可删除的重复测试。
- 代表性断言拒绝 legacy org-unit ID、任意范围、失效平台/租户和无锚点访问，并检查 scope 转移会同时失效原/目标 membership；均由 `begin`/`rollback` 隔离。
- 未发现新增问题。合同实际 runner 与固定基线 migration head 的可运行性未验证。
