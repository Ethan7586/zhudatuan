# AU-051｜audit 审计记录、查询与归档深审

- 审计 sink 已绑定到 Console Support、Identity Registration、Catalog、Purchase、Payment Webhook 等运行时；写入前按 scope 获得事务 advisory lock，并将 command/access 记录链入同一哈希链。
- `RedactionPolicy` 对密码、token、验证码、密文、卡号、电话、邮件和地址进行截断/最小化；`AuditRecord` 对稳定排序 JSON 做 SHA-256 hash。审计数据迁移施加不可变 trigger，只有带 jobs workload 和 archive 标志的 shopjob 删除能通过。
- archive bootstrap 由 `20260821050000_audit_lifecycle.sql` 建立；Worker 注册 `auditarchive`，确定性对象路径、KMS 信封、对象 sha256/metadata 验证、archive reference 插入和源行删除形成“先存档、后删除”的事务闭环。空/部分批次按小时续排，满批立即续排。
- Console 不存在独立 audit feature；Access 的角色历史经 `audit.records.read` 间接消费。查询以 `audit.scope_allowed` 和当前执行 scope 双重限制。
- 本单元 438 行模块文件已按入口、领域、持久化、归档、测试和兼容导出审阅。未发现 P0–P3 新问题；正式 Vitest 因固定审计工作树缺 `vitest` 命令未启动，未安装依赖。
