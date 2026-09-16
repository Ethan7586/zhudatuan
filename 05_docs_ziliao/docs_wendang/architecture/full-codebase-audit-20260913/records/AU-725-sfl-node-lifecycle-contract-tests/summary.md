# AU-725｜SFL 节点生命周期数据库合同测试

- 审阅范围：administrator segment scope、company template clone、execution kernel、hosted mall opening、hosted node provisioning、member registration progression、multi-realm membership、node context/sovereignty 与 sovereign upgrade 的 17 份 SQL bootstrap/contract 文件。
- 审阅方式：深入审阅差异化的权限隔离、节点开通、克隆、幂等、回滚与主权升级主路径；同构 bootstrap 夹具和重复断言作结构性审阅。未运行 SQL，避免审计向数据库写入。

## 审计结论

- **G0：全部保留。** 这些不是可合并的 smoke 文件：它们分别保存了管理员分段权限、公司模板克隆、运行幂等记录、托管节点/商城开通、多 realm 成员关系、节点上下文与主权升级的业务契约。
- 代表性合同通过显式业务异常、幂等回放、隔离状态比对和反向路径断言覆盖失败情形；`begin`/`rollback` 的使用按文件运行模型而异：独立 contract 以事务隔离，bootstrap 文件为被对应测试执行器装载的固定夹具，非独立清理脚本。
- 未发现新增问题。未验证：测试执行器实际如何将 bootstrap 与 contract 组合、及其对当前 migration head 的运行兼容性；该项不写成已验证事实。
