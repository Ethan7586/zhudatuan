# AU-282｜授权决策审计端口深审

`DecisionSink` 定义授权结果的最小审计契约；`PgDecisionSink` 为每条结果建立数据库事务、设置请求数据库上下文后写入 `access.decisionaudit`，失败时回滚并释放连接。`AccessPipeline` 对成功和失败授权均调用该端口；支付内部资金动作另记录金额风险结果。运行时在 Commerce、Console、WebBusiness、Purchase、MallProvisioning、CatalogOperator、IdentityRegistration 等入口注册 PostgreSQL 实现。

`access.decisionaudit` 的结果值受数据库检查约束限定为 allow/deny/challenge/review，历史 RLS 策略以 actor 或 scope 上下文约束写入。AccessPipeline fixture 验证成功与跨受众拒绝均产生相应决策，但 `PgDecisionSink` 本身没有专属集成测试；本轮因审计工作树未安装 Vitest 依赖，未执行测试。未发现 P0–P3 新问题；数据库适配器的直接测试缺口保留为后续测试覆盖审计线索。
