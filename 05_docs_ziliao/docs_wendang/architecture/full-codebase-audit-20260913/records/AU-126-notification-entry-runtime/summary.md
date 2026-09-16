# AU-126｜Notification 入口与身份队列运行单元深审

Notification 的完整 HTTP module 与 identity selected module 具有独立 operation 边界。identitynotification 由专用 runtime、数据库身份、配置和 QueueJob 处理，并由 backlog monitor 监测。未发现 P0–P3；已有 F-0143/P1 不在本 AU 新增。
