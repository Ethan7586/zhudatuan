# AU-003｜Canonical API、Jobs、Ready 与 Migration 进程入口总图

## 1. 唯一目的与边界

本单元只回答 Canonical Commerce 的 API、Jobs、Ready 和 Migration 如何被构建、注册、启动、探测、停止及交付。业务模块内部正确性、全量数据库迁移语义、队列生产者逐项闭环、GitHub/ECS 全发布流程和任何修复均不属于本单元。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；AU 开工 HEAD/CP-02 为 `6a6b4145824848d63d714d3f1757c38ca5222f94`。
- 纳入：Commerce `entry` 的 29 个生产 TypeScript 入口、共享 API/Jobs/迁移启动内核、10 个发布服务 target、对应 systemd/remote policy，以及形成四项问题最小证据链的文件。
- 明确未做：安装依赖、构建、启动本地数据库、迁移重放、故障注入、业务 handler 深审、代码修复、删除、推送、合并、部署或任何线上写入。

## 2. 覆盖

- [FACT][E-AU-003-002] `entry` 有 37 个 TypeScript 文件：29 个生产入口（28 个 `*Main.ts` 与 `JobsEntrypoint.ts`）共 798 行，另有 8 个入口测试。
- 本单元深入审阅 43 个文件、1,904 行：29 个生产入口、10 个共享启动内核，以及 CreateMall 发布链与 Catalog Ready 链的 4 个关键文件。
- 另对 51 个直接依赖文件作结构性审阅，包括 11 个 runtime factory、8 个入口测试、发布规则/代理、11 个 systemd unit 和 staging 兼容资料；结构性审阅不等于业务实现深审。
- 7 个高风险入口反向重追样本覆盖本单元 43 个深审文件的 16.3%，高于补充协议要求的 15%；均由同一主审逆向复核，不冒充第二位独立审计者。
- CP-03 后全仓总账为：已深入审阅 70、已结构性审阅 815、自动生成 69、构建产物 3、归档文件 507、暂未审阅 2,774，共 4,238 个固定基线文件。
- 300 个迁移 SQL 本单元只作事务包装与执行顺序机械盘点：207 个显式含 `BEGIN/COMMIT`，93 个无显式事务且全部位于冻结历史头 `20260820133000` 及之前。没有逐迁移评价业务语义，也没有提升其覆盖状态。

## 3. 真实进程架构

1. [FACT][E-AU-003-003][E-AU-003-004] Commerce 全量构建按文件名发现 28 个 `*Main.ts`，并另行显式追加 9 个 seed/local-infra 入口；正式发布不使用该集合，而由 `serviceTargets` 显式白名单定义 10 个服务 target、19 个 Main/Ready 制品。`JobsEntrypoint.ts` 不在任一构建发现集合中。
2. [FACT][E-AU-003-005] API 入口统一执行 environment → target runtime → selected modules/operation allow-list → `bootstrapApi` → `HttpApp` → loopback `NodeServer`；注册表冻结后才返回 app。
3. [FACT][E-AU-003-006] 正式 API 被拆成 Identity、Mall Provisioning、Support、Purchase、Web、Catalog Operator 和 Payment Webhook 七个进程，而不是运行聚合 `ApiMain`。
4. [FACT][E-AU-003-008] Ready 不是统一协议：四个 API 请求自身 `/health/ready`，Support 用 curl，Payment Webhook 用缺签名负向业务探针，Catalog API 只创建并关闭第二个独立 runtime；三个 Jobs Ready 也只创建并关闭依赖 runtime。
5. [FACT][E-AU-003-009] 当前发布 Jobs 是 Identity Notification、Catalog 和 Payment 三类专用进程；聚合 Full Jobs 注册 32 个模块、33 个 `JOB_CATALOG` 任务、OutboxRelay 和 RuntimeScheduler，但没有进入当前 10 个服务 target。
6. [FACT][E-AU-003-012] 当前正式迁移入口是 release engine 生成的 `DatabaseMigrationExecutor.js`，不是常驻 systemd 进程。它携带 300 个 SQL 与冻结历史清单，按 source SHA 建执行目录后调用通用 `MigrationRunner`。
7. [FACT][E-AU-003-015] 2026-09-13 只读生产快照在已核验实例 `i-2zeewhay0farxq8lucrd` 上看到 12 个对应服务实例 active/running；旧 `zhudatuan-migration.service` 为 inactive/dead。该快照运行的是基线后的不同制品，只能证明进程名和启动关系，不能替代固定基线代码结论。

## 4. 本单元问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0011 | P2 | `CreateMall.ts` 是 Mall Provisioning 生产调用链的一部分，但默认 affected-target 规划将其归为零 target、零验证，单独变更不会生成或部署 `mall-provisioning-api` 制品 |
| F-0012 | P2 | JobRunner、OutboxRelay 和 RuntimeScheduler 的正常 timeout 路径不移除 abort listener；长寿命空轮询按周期线性保留闭包 |
| F-0013 | P2 | 新迁移 SQL 自己提交后，ledger 在下一条独立语句登记；两者间失败会形成“数据库已前进、ledger 未前进”的不可自动恢复窗口 |
| F-0014 | P2 | Catalog API 的 systemd `ExecStartPost` Ready 创建第二个 runtime，不请求已启动 HTTP 进程；release health 又只检查 unit active，不能证明真实服务端口/路由可响应 |

本单元没有发现 P0、P1、G3 或 GX，因此不触发立即停止或强制第二审计者复核。既有 F-0001 仍只是 P1 候选。累计计数更新为：P0 0、P1 候选 1、P2 11、P3 1、NIT 1。

## 5. 值得保留的设计

- [FACT][E-AU-003-003][E-AU-003-005] 正式服务 target 与 operation allow-list 均显式枚举；新增 Main 或业务 operation 不会自动扩大生产面。
- [FACT][E-AU-003-010] JobRunner 使用 `FOR UPDATE SKIP LOCKED`/租约、heartbeat、限并发、指数重试和事务性 deadletter 状态转换；F-0012 不否定这些正确边界。
- [FACT][E-AU-003-012][E-AU-003-014] 迁移执行验证 source SHA、冻结的 94 文件哈希历史、数据库角色、advisory lock、目标 schema，并输出 before/after ledger 结构化回执；发布系统明确记录 forward-only，而非伪装支持数据库回滚。
- [FACT][E-AU-003-008] Payment Webhook Ready 以“缺签名必须在打开数据库事务前返回确定错误”作为负向探针，既证明路由可达，也避免 readiness 产生业务写入。

## 6. 验证结果

- `node --test 04_tools/release-engine/test/zdt-adapter.test.mjs`：18/18 通过。
- `node --test 04_tools/release-engine/test/planner.test.mjs`：15/16 通过；第 14 项在动态 Commerce impact 分析加载 `esbuild` 时因本 worktree 未安装依赖失败，未修改环境。
- `node 04_tools/scripts/audit/migrations.mjs`：在加载 `typescript` 时因未安装依赖失败；没有重放数据库，也没有把失败当成迁移正确性结论。
- release planner 的直接只读调用确认 `CreateMall.ts` 返回 `targets=[]`、规则 `mall-provisioning-isolation`、`impact=validation-only`、无 validations。
- 与源码相同的 wait/AbortSignal 模式完成 12 次正常 timeout 后，`getEventListeners` 返回 12 个 retained abort listeners。
- 生产只读检查仅查询 IMDS、systemd 属性和 journal；未改变 unit、指针、数据库、网络或文件。

Commerce Vitest、类型检查和构建未执行，因为独立审计 worktree 没有依赖且本单元禁止安装。上述未执行项均标记为环境阻塞，不写成“通过”或“失败的产品行为”。

## 7. 未知项与删除纪律

- `JobsEntrypoint.ts` 没有当前构建制品消费者，但保留 profile dispatch 测试和兼容意图；只记为 UNKNOWN，不进入 G1–G3。
- `ApiMain`、`JobsMain`、`FullJobsMain`、`MigrationMain` 和 `RegistrationMigrationMain` 没有当前正式 target，不代表没有本地、staging、恢复或历史兼容责任。
- 33 个通用 Jobs 的生产者、消息数据版本、每个 processor 的幂等边界和恢复闭环尚未逐任务验证。
- 300 个迁移的业务可逆性、每个事务内不变量、线上 ledger 当前内容和备份恢复能力留给数据专项。
- 生产快照与固定基线不是同一 SHA；任何线上现象必须在后续增量审计中单独归因。

## 8. 检查点纪律

CP-03 只允许包含本审计目录内的报告与覆盖清单。提交前必须确认没有源码、测试、配置、工作流、迁移、依赖、锁文件或生成输出被夹带；提交后停止，等待下一 AU 授权。
