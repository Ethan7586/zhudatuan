# AU-723｜Payment 与 Refund 数据库合同测试套件

- 审阅范围：`02_platform_pingtai/database/supabase/tests/` 下 11 份 internal payment、outbox/effect/recovery/query、refund ACL/reconciliation/supersession 合同 SQL。
- 审阅方式：深入审阅 suite 的 transaction rollback、fixture隔离、权限/幂等/lease/状态机 assertion；相邻同框架的 payment 场景按业务差异结构性审阅。未运行 SQL，因为正式合同入口会写入测试数据库。

## 审计结论

- **G0：全部保留。** 每份文件覆盖不同 payment 失败传播或授权边界：internal tender effect/replay、deadletter、effect processor、Mall identity、operation recovery、outbox consumer、query close、refund ACL/supersession/reconciliation。
- 所有审阅文件以 `begin` 开始并以 `rollback` 收尾；动态 fixture 使用随机 suffix/UUID，assertion通过 `raise exception` fail closed，不是无效 smoke tests。
- 未发现新增问题；测试是否已在当前 migration head 正常运行未验证，且不得从“未运行”推断测试或业务实现无用。

## 未验证项

- 未实际运行测试，未核对正式执行器、数据库 bootstrap 或最新 migration head 是否匹配这些 legacy `public.*` contract fixtures。
- 对应生产代码/迁移风险按已完成的 Payment/Refund 审计单元分别记录；本批不重复推导业务缺陷。
