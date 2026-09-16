# AU-471｜客户端错误遥测注册与授权

- 主审 `20260821064000_add_client_error_telemetry.sql`（52 行），并人工反查 Observability module、`ClientErrorOperations`、`ClientErrorBuffer`、模块目录与既有发布审计；未执行迁移、服务或线上查询。
- 迁移登记两个正式 operation：member 可 `POST /api/v1/telemetry/clienterrors`，operator 可 `GET` 同路径；其权限、rolepermission、capability、audience、platform entitlement 与 runtime schema checksum 同步写入并断言为完整契约。
- 代码链为 OperationController → ObservabilityModule → `clientErrorOperations`。create 从 active membership 派生组织 scope，再写入带脱敏与容量/7 日保留的进程内 buffer；read 按 server-derived access scope 过滤。迁移没有直接创建或授权业务表。
- 已有 **F-0066/P2** 精确覆盖其关键运行断链：操作、SDK 与模块虽完整，固定正式发布入口没有装载 ObservabilityModule；已有 **F-0055/P2** 覆盖 buffer 的异常 scope containment 关闭不足。本轮未重复编号或上调，未发现新增 P0–P3。
- **G0**：operation/permission/capability 三者是当前实现及契约的共同注册事实，不可按“未在生产入口装载”删除。未验证真实 release target、RLS/授权查询、遥测写入脱敏结果或在线路由响应。
