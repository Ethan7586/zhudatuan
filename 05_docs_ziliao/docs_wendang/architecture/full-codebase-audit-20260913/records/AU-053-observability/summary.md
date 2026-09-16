# AU-053｜observability 客户端错误入口深审

- `ObservabilityModule` 是平台模块，只提供 client-errors HTTP 操作；业务存储、事件和 Jobs 不归它拥有。
- create 必须通过登录成员，用 membership 反查组织 telemetry scope；surface、route、message/stack 上限受校验。Telemetry adapter 与 ClientErrorBuffer 在记录/写出时再次脱敏、指纹去重、容量和七日保留均由 AU-013 已审实现承载。
- read 仅接受 operator 受众，按 access scope 层级过滤缓冲记录。写操作审计对 observability body 使用 `{redacted:true}`，不会把客户端 stack 复制到 audit facts。
- 缓冲为 process-lived 设计；多进程/重启的跨实例聚合并不由本模块承诺，未将其作为数据丢失事实。
- 未发现 P0–P3 新问题；模块 manifest 测试及 telemetry 包测试均未执行（固定工作树缺 Vitest）。
