# Runner 1.6 简单发布

状态：ACTIVE

普通发布只有一个入口：

```text
/Users/Ethan/.codex/bin/zdt-delivery release <full-source-sha>
/Users/Ethan/.codex/bin/zdt-delivery release <full-source-sha> <target> <physical-node>
/Users/Ethan/.codex/bin/zdt-delivery status <full-source-sha-or-r16-release-id>
/Users/Ethan/.codex/bin/zdt-delivery retry <r16-release-id>
/Users/Ethan/.codex/bin/zdt-delivery retry <r16-release-id> <target> <physical-node>
/Users/Ethan/.codex/bin/zdt-delivery rollback <target> <physical-node>
```

控制端每次读取最新 `origin/zdt-next`，只派发 `delivery-1-6.yml`、查询 GitHub 运行并展示结果。控制端不安装依赖、不构建、不上传制品、不连接生产，也不执行回滚。

GitHub 工作流先选择可立即执行的阿里云 Build Runner；没有匹配 Runner、Runner offline/busy 或状态不可读时直接使用 `ubuntu-24.04`。两种执行位置都调用 `.github/actions/runner-1-6/action.yml`，后者只调用同一个 `scripts/runner-1-6.sh` 和 `runner-1-6.mjs` 核心。阿里云任务若在核心启动前失败，GitHub Hosted 执行相同核心；核心启动后不自动换路。

不带目标的 `release` 使用完整业务 Source SHA 计算受影响目标，保持数据库迁移、运行时和前端的依赖顺序。可读的普通 OSS 制品缓存会复用；缓存缺失或内容不完整时重新构建。

带 `<target> <physical-node>` 的 `release/retry` 是按 1.3 原则重写的基础生产切换：它只接受已经存在且与 Source SHA 匹配的不可变制品，不安装依赖、不测试、不构建。生产计时只包含制品解析、SSH 下载与校验、原子更新 `current/previous`、重启、健康检查和失败自动恢复，目标为 60 秒以内。制品不存在就立即失败并提示在生产切换外准备，不把构建偷偷塞进部署现场。60 秒结果只是观测数据，不是阻塞发布或恢复的门禁。

OSS 只是缓存和不可变制品存储，不是审批者。正常路径和目标节点都不创建全局锁、目录锁或解锁状态，也不存在 Seal、Closure、Claim、Lease 或另一份可部署权威。若两个切换并发，后完成的旧任务发现 `current` 已被更新时只报告被新切换取代，不会把新版本回滚掉。

生产状态只读取目标机 `current`、`previous`、服务进程和健康结果。GitHub Actions 的绿色状态不是生产成功事实。用户状态固定为 `QUEUED / RUNNING / HEALTHY / FAILED / ROLLED_BACK / UNKNOWN`；节点读取失败显示 `UNKNOWN`，不会冒充生产失败或阻止独立回滚。确认失败时输出阶段、目标、命令、退出码、底层输出、服务状态和恢复结果。

历史维修、灾难恢复和控制面安装仍由 [RECOVERY.md](RECOVERY.md) 的独立入口处理，不得被普通 `release` 调用。

“高级”只表示更快、更稳定、更自动、更容易恢复和扩展；不表示增加安全锁、审批、Seal、Closure、Claim、Lease、签名、证明链或其他门禁。
