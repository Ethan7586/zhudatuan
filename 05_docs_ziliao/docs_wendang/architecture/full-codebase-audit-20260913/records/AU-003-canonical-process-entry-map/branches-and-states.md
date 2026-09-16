# AU-003｜启动、运行与失败状态

## API 状态机

1. 环境与 runtime factory 成功 → selected module 注册 → registry/container freeze → loopback listen。
2. 环境、manifest、secret、数据库角色或 schema 校验抛错 → 顶层启动失败 → systemd `Restart=on-failure`。
3. Identity/Mall/Purchase/Web 的 Main 已启动但 `/health/ready` 非 200/ready → ExecStartPost 在最多约 30 秒内失败 → unit 启动失败。
4. Payment Webhook 只有唯一业务路由；缺签名负向请求返回 400/`PROVIDER_SIGNATURE_MISSING` 才算 Ready。
5. Catalog API 的 Ready 只验证新建 runtime；运行进程的 listen/route 没被探针请求，形成 F-0014。
6. SIGINT/SIGTERM → 关闭 NodeServer → 关闭 runtime → 退出 0。进程级强杀与超时清理尚未故障注入。

## Jobs 状态机

1. 专用 Jobs 的 ExecStartPre 新建并关闭 runtime；失败时 worker Main 不启动。
2. Main 创建一个 AbortController，把同一 signal 交给该进程的全部 QueueJob。
3. claim 无行 → 等待 poll → 重试；当前正常 timeout 不移除 abort listener，形成 F-0012。
4. claim 有行 → Semaphore 限并发 → processor + deadline + lease heartbeat。
5. 成功 → 带 lease owner/scope 条件更新 completed；更新不到一行视为 `JOB_LEASE_LOST`。
6. 失败且 attempts 未耗尽 → 事务内改回 queued 并设置 retry delay；耗尽 → 写 deadletter 并改 failed。
7. SIGINT/SIGTERM → signal abort → 等待任务 settle → close runtime。Full Jobs 还会在 cache unavailable 时 abort。

## Migration 状态机

1. release 选择 `database-migration` → 构建 executor + 300 SQL + `history.json` → remote agent 复制到 source-SHA 执行目录。
2. executor 校验 source SHA/snapshot ref/owner connection → 读取 ledger before → 计算未应用集合。
3. MigrationRunner 校验角色 → 获取 session advisory lock → 校验 94 文件冻结历史 → 顺序执行未登记迁移。
4. 现代 SQL 自己 `COMMIT` → runner 再单独 INSERT ledger；此窗口失败时进入 F-0013。
5. 全部完成 → 校验目标 schema head 和 public 表清空 → executor 比较 ledger after → 输出 applied/noop 回执。
6. executor 失败 → 输出 failed 回执并退出 1；release 不切服务 pointer。
7. 数据库 applied 后服务 pointer/health 失败 → 只恢复 pointer，明确记录 `databaseRollback=not-performed`。
8. 独立 rollback 命令对 migration target 返回 `DATABASE_ROLLBACK_UNSUPPORTED`。

## 生产只读状态

2026-09-13 快照中 12 个服务实例均为 active/running；L0 Identity Notification Jobs 的 `NRestarts=189`。journal 显示依赖未就绪期间 ReadyMain 因 unsettled top-level await 反复失败，06:26:31 输出 Ready 后 worker 才启动。这证明 ExecStartPre 确实阻断 Main，也不证明 F-0012 已造成生产事故。
