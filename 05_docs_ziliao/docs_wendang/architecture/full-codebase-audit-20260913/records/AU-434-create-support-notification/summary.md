# AU-434｜支持与通知初始模型

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821023000_create_support_notification.sql`。
- 交叉核对：后续索引、授权边界及 Support/Notification 的操作、SLA worker、投递仓储实现。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放、构建、测试、消息投递或线上操作。

## 运行结论

支持域建立 case、密文 message、审计事件、分派、坐席、SLA、证据和单次升级约束。后续迁移和应用将当前运行模型收敛为 ticket/conversation 等名称并补足 scope 字段；这一演进不能作为初始迁移无用的证据。SLA worker 以消息和截止时间执行升级判断。

通知域建立版本化模板、成员偏好、加密端点、带全局 idempotency key 的 dispatch 及按时间分区的 attempt。投递仓储以 queued/sending/sent/failed 状态推进并保存供应商尝试；后续索引和授权解析使用 dispatch 的受众/范围字段。

## 审计结论

- G0：工单、加密消息、SLA、通知幂等投递和尝试审计的基础关系模型，不是删除候选。
- 初始 support 表名与现行 ticket/conversation 运行模型的承接由后续迁移承担，未发现可证明的孤立残留；删除前必须连同迁移链和数据回填专项复核。
- 未执行消息加解密、分区保留或真实投递重试验证；保持未验证。
- 本批未新增 P0–P3。
