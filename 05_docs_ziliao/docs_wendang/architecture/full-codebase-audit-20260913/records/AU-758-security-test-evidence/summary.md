# AU-758｜Security 测试证据

- 审阅范围：authorization 与 HTTP security specs。
- 审阅方式：两文件均深入审阅，反向核对 root `test:security` entry；未重复运行，因 AU-756 已证明当前审计工作树无法解析内部 workspace packages，且此处结论来自测试构造与调用边界。

## 审计结论

- **G0：两份 spec 均有明确的快速回归职责。** authorization 覆盖 cross-mall/cross-tenant、access version、explicit deny 和 step-up 时间窗；HTTP 覆盖 Origin/CSRF、ticket-exchange 例外、安全 headers、request id、media/body size rejection。
- **F-0299（P3）：** suite 未启动真实业务安全链路。授权数据和处理器都是内存 fixture，因而不能当作 session、controller authorizer、DB/RLS 或敏感业务写操作的端到端安全证明。
