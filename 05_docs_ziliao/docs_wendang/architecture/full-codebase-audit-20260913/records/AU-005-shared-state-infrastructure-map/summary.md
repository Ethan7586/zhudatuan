# AU-005｜共享状态基础设施总图

## 1. 唯一目的与边界

本单元只回答固定基线中的 PostgreSQL、Redis、对象存储、Secrets/KMS、数据库队列和进程内共享状态如何创建、由谁启动、谁连接、谁拥有数据或密钥、如何共享以及谁负责恢复。它不深审业务表、业务任务 processor、云账户侧备份策略，也不实施任何修复。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；AU 开工 HEAD/CP-04 为 `0bb7b165b89b699bbfffc1abfc72bd1fbc3f2421`。
- 纳入：PostgreSQL 创建/代理/连接池/事务上下文，Redis cache，`runtime.outbox|inbox|job|lease|deadletter`，Local Secret Store、Local KMS、Local Objects、Catalog 媒体 OSS、正式 target/systemd/env 与恢复责任。
- 排除：凭据明文、线上数据库内容、云账户备份/快照实况、全量迁移重放、业务表字段、各 job processor 的业务幂等、任何服务启停或状态写入。

## 2. 覆盖

- 深入审阅 64 个人工文件、3,920 个物理行：共享状态核心实现、生产入口、客户端、关键事务/租约逻辑和对应定向测试。
- 结构性审阅 36 个人工文件、4,801 个物理行：大型注册表、环境解析、迁移、发布目标、systemd、Docker Compose、检查脚本及对象存储消费者。
- 核对 1 个自动生成文件、150 个物理行：`app/events.ts`；生成来源是 contract definitions，排除逐行风格评价，但核对了生产消费者和 handler 映射。
- 本 AU 合计触达 101 个文件、8,871 个物理行。`files.csv` 逐文件记录审阅范围；全仓状态以 `10-coverage-manifest.csv` 为唯一总账。
- 对 10 个深审入口执行反向重追，占 64 个深审文件的 15.6%，达到高风险模块 15% 抽样要求；这是同一主审的逆向自检，不冒充第二位独立审计者。
- F-0021、F-0022、F-0023 和 GX-0001 已进入独立复核队列，当前均为“待第二位独立审计者”。

## 3. 真实状态设施架构

~~~mermaid
flowchart LR
  API[Canonical APIs] -->|connection ref→Secret Store| PG[(PostgreSQL)]
  Jobs[Dedicated Jobs] -->|job connection ref| PG
  API -. generic runtime only .-> Redis[(Redis cache)]
  Commands[业务命令] -->|同事务 append| Outbox[(runtime.outbox)]
  Aggregate[JobsMain / FullJobsMain\n当前无正式 target] --> Relay[OutboxRelay + Scheduler]
  Relay -->|inbox + enqueue tx| Queue[(runtime.inbox + runtime.job)]
  Jobs --> Queue
  API -->|Bearer over loopback TLS| Secrets[Local Secret Store]
  Jobs -->|Bearer over loopback TLS| Secrets
  API -->|Bearer over loopback TLS| KMS[Local KMS]
  Jobs -->|Bearer over loopback TLS| KMS
  API -->|object bearer| Objects[Node-local Local Objects]
  Jobs -->|object bearer| Objects
  Objects --> Disk[/StateDirectory/]
  Catalog[Catalog media] --> OSS[Aliyun OSS targets]
~~~

1. [FACT][E-AU-005-002] PostgreSQL 是业务数据、幂等、outbox、inbox、job、lease 和 deadletter 的共同持久层；应用按 API、Jobs、Migration profile 建立不同 workload pool，并在事务内设置调用上下文。
2. [FACT][E-AU-005-004] outbox→inbox/job 的发布与 inbox 去重在数据库事务中完成；outbox 的 `published_at` 随后单独更新，因此崩溃重放依靠 inbox 幂等。
3. [CONFLICT][E-AU-005-003][E-AU-005-004] 唯一创建 `OutboxRelay` 与 `RuntimeScheduler` 的入口是 `JobsMain`/`FullJobsMain`，但production release/remote policy没有这两个target；full-staging虽有聚合Jobs unit，却被显式要求保持inactive。当前live backlog未查询。
4. [CONFLICT][E-AU-005-006] Secret/KMS 客户端发送 Bearer，仓库也实现 exact-resource policy；实际打包和 systemd 启动的 Main 却自行定义无鉴权 handler，既不调用授权 handler，也不读取已解析的 policy。
5. [FACT][E-AU-005-007][E-AU-005-008] Local Objects 按节点写 host `StateDirectory`，对象引用按内容 SHA-256；上传校验完整性并签发短期 URL，但生产 URL 固定为 loopback，且 completion 无扫描器即写入 `scan=clean`。
6. [FACT][E-AU-005-009] Redis 是可降级 cache；连接或命令失败后客户端销毁且不重连。当前正式 dedicated target 不创建它，聚合 runtime/staging full Jobs 才消费该路径。
7. [CONFLICT][E-AU-005-010] 正式 registration Compose 固定 PostgreSQL 17，却把显式拒绝 `server_version_num>=170000` 的初始化脚本挂进首次建库目录；现有检查只运行 PostgreSQL 16 fixture。

## 4. 本单元问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0021 | P1 候选 | Secret Store/KMS 生产入口绕过已有 Bearer 与精确资源授权，待 RV-0003 |
| F-0022 | P1 候选 | 正式 target 图无 OutboxRelay/Scheduler，数据库异步事件没有正式发布进程，待 RV-0004 |
| F-0023 | P1 候选 | PostgreSQL 17 Compose 与仅接受 16 的首次初始化脚本互斥，恢复/新卷路径会失败，待 RV-0005 |
| F-0024 | P2 | 通用 `claim_job` 不回收过期 running；正式 Catalog export 使用该通用分支 |
| F-0025 | P2 | Local Objects 把浏览器下载 URL 签为 `127.0.0.1`，远端 Console 无法访问 |
| F-0026 | P2 | Local Objects 未执行恶意内容扫描却把所有成功上传标为 `clean` |
| F-0027 | P2 | 内容哈希唯一 metadata 可被相同字节、不同 path/content-type 的后续上传覆盖 |
| F-0028 | P3 | Redis 首次或瞬时失败后不会在进程生命周期内恢复连接 |

本单元没有 P0 证据。三项 P1 都是候选级别：代码和正式运行图证据已闭合，但未读取 live 数据、未证明已发生外泄/积压/恢复事故，且尚未完成独立复核。

## 5. 垃圾代码判定

- `Handler.ts` 与 `WorkloadAccessPolicy.ts` 虽无生产调用，却保存唯一 Bearer/资源授权实现和反事实测试，标为 G0，不是删除候选。
- `JobsMain`、`FullJobsMain`、`OutboxRelay` 与 `RuntimeScheduler` 当前不在正式 target 图，但承担唯一通用事件发布、调度和 cleanup 责任，标为 GX-0001；在重新设计和独立复核前禁止删除。
- 本 AU 没有 G1、G2 或 G3。零运行入口在这里是缺失接线证据，不是删除证据。

## 6. 值得保留的设计

- workload-specific PostgreSQL pool 明确连接数、连接/空闲/statement/idle-transaction timeout 和 `application_name`。
- command transaction 使用 serializable、稳定排序的进程锁和 PostgreSQL advisory lock；仅对 `40001/40P01` 有界重试，并在解锁异常时销毁连接。
- outbox 保持 aggregate 内顺序；inbox 去重与 job enqueue 同事务；job 有 SKIP LOCKED、lease、heartbeat、deadline、重试和 deadletter。
- KMS 使用 AES-256-GCM、随机 nonce、context AAD、按 keyRef 派生密钥和 HMAC fingerprint；缺陷在入口授权接线，不在加密原语。
- Object Store 对分片顺序、大小、总 SHA-256 和短期签名做校验；Catalog 媒体 OSS 使用内容寻址 key 并核对多目标 size/hash metadata。
- staging PostgreSQL TLS proxy 固定 loopback，校验 CA、hostname 和 TLS；未把代理的存在误画成生产 registration Docker 的下游。

## 7. 验证结果

- 正式 workspace 测试入口已识别；`@shop/localsecrets`、`@shop/localkms`、`@shop/localobjects` 定向命令因审计 worktree 未安装 `tsx` 而在加载前阻塞。
- 直接使用 Node strip-types 的三包测试也在 extensionless TypeScript import 解析阶段阻塞。两次都属于环境阻塞，不是实现通过或失败。
- 未安装依赖；未运行全量测试、全量构建、数据库重放、Redis/Object/KMS 写入或故障注入。
- 只读结构断言重新确认：授权 handler 的生产引用数为 0；正式 target 不含 aggregate Jobs；存在 49 个 outbox 写入源码文件；Compose 为 PG17而 init拒绝17；object URL为loopback；`scan=clean`由 completion直接赋值；Redis关闭重连。

## 8. UNKNOWN 与恢复责任

- [UNKNOWN][E-AU-005-012] 仓库只证明 production PostgreSQL host bind volume、node-local object StateDirectory 和共享 secret catalog 的位置；没有发现当前 zhudatuan 数据库/Local Objects 的备份创建与恢复演练入口。`delivery.yml` 仅要求采集器不要删除 `database-backups`。不能据此断言云侧没有快照或人工备份。
- [UNKNOWN] Local KMS 固定 `keyVersion=local-v1` 且只接受单个 master key；仓库未见轮换、多版本解密或恢复流程。master key 的外部托管、备份和 owner 未验证。
- [UNKNOWN] 未查询线上 `runtime.outbox`、`runtime.job`、deadletter 或 object 目录，因此积压数量、孤儿 running job、对象实际可下载率和历史污染范围均未验证。
- [UNKNOWN] Catalog media 的 OSS 账户生命周期、版本控制、跨地域恢复和凭据 owner 不在仓库证据内。

## 9. 检查点纪律

CP-05 只允许包含本审计目录内的报告、证据索引和覆盖清单。提交前必须逐项核对 staged diff，确认没有源码、测试、配置、工作流、迁移、依赖、锁文件或生成输出；提交后停止，等待下一审计单元授权。
