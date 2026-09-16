# AU-004｜发布与节点运行总图

## 1. 唯一目的与边界

本单元只回答固定基线如何从 GitHub 手工触发，形成 release target 与制品，经 SSH/OSS 写入节点 pointer，再由 systemd、Caddy 和 Cloudflared 暴露，以及失败和回滚在哪些边界传播。它不深审业务 handler、数据库迁移内容、Cloudflare/OSS 账户配置，也不实施任何修复。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；AU 开工 HEAD/CP-03 为 `d651127d6bcaa45e45704541775be14d0d3d524e`。
- 纳入：3 个 GitHub workflow、release manifest/policy/engine、15 个 target、2 个逻辑节点、18 个正式 systemd/release-policy unit、两套 Caddy 边界、Cloudflared、OSS Console 激活、release retention 和 AutoNode 控制面。
- 明确未做：安装依赖、生产构建、数据库重放、服务启停、指针切换、云资源修改、代码修复、删除、推送、合并或部署。

## 2. 覆盖

- 深入审阅 45 个人工文件、4,283 个物理行；包括 workflow、release/edge 配置、systemd unit、关键 planner/激活脚本、retention、legacy 入口和 AutoNode 小入口。
- 对 28 个人工文件、9,347 个物理行作结构性审阅；包括 release engine 大型执行器与测试、AutoNode engine/provider 与测试、根 package 命令和 manifest 生成器。大型文件只对本 AU 所列逻辑区间形成深结论，不能据此宣称其全部实现已逐行深审。另对 2 个自动生成 node manifest、396 行核对生成来源、拓扑和消费者，不逐行风格审阅。
- 合计触达 75 个文件、14,026 个物理行。覆盖状态以 `10-coverage-manifest.csv` 为唯一总账；本目录 `files.csv` 逐项区分 45 个全文件深入审阅对象、28 个结构性审阅对象和 2 个自动生成输出。
- CP-04 后全仓总账为：已深入审阅 115、已结构性审阅 807、自动生成 69、构建产物 3、归档文件 507、暂未审阅 2,737，共 4,238 个固定基线文件。
- 8 个入口反向重追样本占 45 个深审文件的 17.8%，高于 15% 要求；均为同一主审的逆向自检，不冒充第二位独立审计者。
- F-0001 与 F-0015 是 P1 候选，进入 RV-0001/RV-0002 独立复核队列；本次逆向抽检不满足该要求。
- 独立复核的入口、禁止捷径和完成判据已固化在 `independent-review-queue.csv`，后续会话可直接续接而无需重扫本 AU。

## 3. 真实发布架构

1. [FACT][E-AU-004-004] 三个 workflow 都只接受人工触发。Direct 固定以 `HEAD^` 为 affected base，并在 plan/deploy 两次传 `--direct`。
2. [FACT][E-AU-004-002] manifest 定义 15 个 target；14 个非迁移 target 形成静态、Node 服务或内容制品，`database-migration` 是一次性 executor。10 个 service target 只有 `after: database-migration`，不会因单独选择服务自动加入迁移。
3. [FACT][E-AU-004-002] `zhudatuan-l0` 与 `hbbtzn-l1` 是逻辑节点；固定 manifest 通过 `hostedBy` 让 HBBTZN 的 Support、Purchase、Web、Catalog、Payment 和 Migration 复用 L0 运行单元。
4. [CONFLICT][E-AU-004-003][E-AU-004-007] business artifact 影响图与 control-plane 安装图是两套机制。配置变更可得到“全部业务 target”或“零 target”，但正式 deploy artifact 不包含触发变更的 Caddy/systemd/Cloudflared 定义。
5. [FACT][E-AU-004-011] systemd unit 以每节点/target current 为运行根，平台 object/secret store 使用 node-wide runtime；unit 隔离边界总体清晰。Ready 语义差异继承 AU-003。
6. [FACT][E-AU-004-009][E-AU-004-010] HBBTZN gateway Caddy 从正式 target pointer 提供前端并反代服务；fufu active Caddy 使用另一套 runtime-recovery current，导致 Auth/Console 与 release pointer 分裂。
7. [FACT][E-AU-004-012] AutoNode 提供显式 sovereign upgrade 的完整 control-plane ledger，但没有固定基线正式 workflow 消费者；它不能填补普通 Deploy 的自动配置交付语义。

## 4. 本单元问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0001 | P1 候选 | fufu Auth/Console active Caddy 根与正式 release pointer 分裂；公网两入口 404，待 RV-0001 |
| F-0015 | P1 候选 | 正式 Deploy 固定 Direct，成功回执跳过仓库已经实现的 readiness、外部验收和自动健康回滚，待 RV-0002 |
| F-0016 | P2 | release agent 与 OSS 脚本可无共享锁改写同一 HBBTZN Console pointer |
| F-0017 | P2 | control-plane 变更会误选全部业务 target或零 target，但制品和正式 Deploy 不应用该配置 |
| F-0018 | P2 | 正式 deployment contract check 在固定基线失败，且只做源码 token 扫描，不能证明 active 发布链 |
| F-0019 | P2 | 三个 SSH workflow 都在运行时信任未预先固定的 `ssh-keyscan` 输出 |
| F-0020 | P2 | affected 规划只比较 `HEAD^..HEAD`，不能覆盖目标实际已部署 SHA 到所选 SHA 的累计差异 |

本单元没有 P0 证据。没有将 legacy、AutoNode、零 target 配置或无静态消费者脚本列为垃圾候选；它们仍有历史、运维、控制面或测试责任。

## 5. 值得保留的设计

- guarded remote activation 对容量、candidate、Caddy 语义、目标/受保护进程、readiness、rollback point 和自动恢复建有完整结构化证据；问题是正式 Direct 没有调用它，不是该设计本身薄弱。
- AutoNode 的精确 plan digest、持久 step ledger、ownership-aware rollback、冲突拒绝和反向 compensation，把外部云资源恢复边界写得很清楚。
- OSS Console 激活采用不可变对象、SHA 校验、解包前置验证、原子 pointer 和公网版本验收；F-0016 只针对跨发布器协调。
- systemd unit 的非 root 身份、文件系统隔离和 capability 收敛整体一致；Storefront 的 DynamicUser 是明确例外，不是权限漂移。
- release retention 同时保护 current/previous/runtime/process CWD/pin/recent/grace，并把删除限制在允许根内。

## 6. 验证结果

- release-engine 定向套件：79/80；唯一失败为缺本地 `esbuild`，记录为环境阻塞。
- AutoNode 定向组合：4 个测试通过；4 个测试文件因缺 `tsx`/完整 TypeScript loader 或 `pglite` 无法加载，未伪装成通过。
- 两份仓库 Caddy 配置只读 validate 通过；关键 JS/Bash 语法检查通过。
- `npm run check:deployment --silent` 真实失败：`DEPLOYMENT_CONTRACT_MISSING:SmokeMain.js`。
- release-policy 行为测试因 macOS Bash 3.2 不满足 Bash 4 语法而未执行；脚本语法检查通过。
- 生产只读核验只查看 IMDS、unit 状态/哈希、active config、pointer/index 存在性、日志和 HTTP 状态；没有任何线上写入。

## 7. UNKNOWN 与不适用记录

- 线上 active control-plane 文件来自基线后提交或主机本地状态；它们只作为当前运行关系证据，不归因成固定基线部署结果。
- 当前未取得 Cloudflare tunnel、DNS 和 OSS bucket 的账户侧完整配置/审计日志；只证明仓库配置和公开入口行为。
- 没有证明 OSS 与 Direct 曾真实并发，也没有确定 fufu 404 起始时间、流量与影响用户数。
- APIs、数据库函数、CSS 与业务事件专项不适用于本 AU，故不创建对应记录；发布通信、配置、锁、状态和失败模式分别记录在专用 CSV/Markdown 中。

## 8. 检查点纪律

CP-04 只允许包含本审计目录内的报告、证据索引和覆盖清单。提交前核对 staged 文件，确认没有源码、测试、配置、工作流、迁移、依赖、锁文件或生成输出；提交后停止，等待 AU-005 授权。
