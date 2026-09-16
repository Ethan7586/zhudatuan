# AU-086｜WebBusiness Reporting Dashboard 读取运行入口深审

WebBusiness 只注册 `reporting.dashboard.read`，复用 canonical `getDashboardOperations` 和 PgReportingRepository。读取在 prepare 阶段解析 period/page/application/supplier，默认 dashboard cache key 包含 scope、metric、period 和 projection version；cache hit short-circuit，不建立数据库事务。

共享 CACHE 绑定不存在时使用进程内 `WebReportingMemoryCache`：512 项上限、过期删除、写入成功后保留 TTL。测试覆盖 cache hit/miss、cursor Date 序列化与 local fallback；未见缓存跨 scope 键冲突或读取绕过 access 的证据。

未发现 P0–P3；未运行 Vitest、未改变运行状态。
