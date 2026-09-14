# 全代码库系统审计｜执行计划

## 1. 计划结论

本次审计不能在单个长会话中完成。固定基线包含 4,238 个文件、3,073 个人工源码文件、322,808 行人工源码、357 个人工数据库迁移和 640 个测试文件。按微观深审协议，初始预计需要约 186–344 个单一目的审计单元；架构阶段完成后再依据真实模块边界修正数量。

每个审计单元必须在一个独立会话内完成一个模块或一条完整链路，提交仅报告检查点并停止。不得为了减少检查点而混合多个大模块。

## 2. 固定边界

| 项目 | 固定值 |
| --- | --- |
| 基线 | 5a1ce71eebbefaa826368a9e1dc17730f9363bc4 |
| 审计分支 | codex/full-codebase-audit-20260913 |
| worktree | /Users/Ethan/.codex/worktrees/full-codebase-audit-20260913/zdt-next |
| 审计分支合并目标 | 无 |
| 允许写入 | 05_docs_ziliao/docs_wendang/architecture/full-codebase-audit-20260913 下的审计报告、记录、证据索引和覆盖清单 |
| 禁止写入 | 生产/测试源码、配置、工作流、数据库迁移、依赖、锁文件、生成清单和任何线上资源 |
| Git | 不变基、不推送、不合并、不删除远程分支、不改变主线 |
| 运行 | 只读观察；不启动、停止、重启或故障注入生产服务 |

origin/zdt-next 后续提交只记录为“基线后变化”，不进入本次审计。任何后续修复从修复时最新主线建立独立小分支。

## 3. 当前阶段与检查点

本计划依据 Ethan 于 2026-09-13 提供的《全代码库微观深审补充协议》建立；收到的 1,059 行原文 SHA-256 为 1db9a93f3f4ab45c5b1abc770e44d1dfa5beb788ef961a09ad6b1cda141b07ac。该哈希只用于证明计划所依据的输入版本，不把附件路径当作长期仓库依赖。

当前进度：CP-00、CP-00A、AU-001/CP-01 至 AU-061 已完成。AU-061 完成 Payment webhook、查询/退款 job、退款结算、deadletter 与人工恢复边界审阅。覆盖总账按当前文件级清单重算：深入审阅896文件/74,091行、结构性审阅810文件/118,855行、自动生成70文件/172,651行、暂未审阅1,952文件。按Ethan最新指令仅确认P0时中断，否则连续进入下一审计单元。

“检查点后停止”仅指结束当前单一目的审计会话，避免在一个会话中混入下一模块；不表示开始修复，也不表示审计被永久中止。所有问题仍只记录，任何未来修复都不在本审计分支实施。

## 4. 审计单元定义

一个审计单元 AU 必须满足：

- 只有一个模块、一条端到端业务链或一个明确平台职责。
- 开始前列出允许读取范围、允许写入报告、禁止范围、验收条件、预计时间和超时停止条件。
- 有明确上游入口和下游终点。
- 可以独立形成结论、验证、复核和回滚建议。
- 结束时更新覆盖总账、记录 UNKNOWN、提交一个仅报告检查点并停止。

### 4.1 大小限制

- 默认每个 AU 审 5–20 个人工文件或不超过约 2,000 行关键实现。
- 大文件按逻辑区域拆分；文件未全部覆盖前保持“暂未审阅”。
- 大模块按 API 链、命令链、查询链、Worker 链或数据对象拆分。
- 数据库迁移可按同一数据所有者和连续演进目的成批，但每个迁移必须有独立记录。
- 预计超过 90 分钟的 AU 在开始前拆分。

### 4.2 时间盒

| 环节 | 默认时间 |
| --- | ---: |
| 工作区与证据预检 | 5–10 分钟 |
| 入口和调用链追踪 | 10–15 分钟 |
| 文件/符号/函数微观审阅 | 25–40 分钟 |
| 定向验证和反事实检查 | 10–15 分钟 |
| 记录、自检、覆盖对账和提交 | 10–15 分钟 |
| 单 AU 硬上限 | 90 分钟 |

连续 10 分钟没有文件记录、证据、调用链或验证结果等可观察进展时，停止扩展范围并报告当前状态。

## 5. 每个审计单元的强制流程

1. 确认分支、HEAD、基线 merge-base 和干净工作区。
2. 确认本 AU 的唯一目的、入口、终点和允许文件。
3. 从 10-coverage-manifest.csv 提取本 AU 待审文件，不重扫全仓。
4. 枚举入口、动态注册、构建、包导出、脚本和运行配置。
5. 建立本 AU 的证据登记表并编号。
6. 对人工文件完整阅读；大文件先登记逻辑区间。
7. 建立导出符号清单，追踪直接、间接、动态和外部消费者。
8. 对关键函数、异步函数、数据库函数和部署函数建立微观记录。
9. 对条件分支、状态机、权限、并发、重试、超时、失败和恢复建表。
10. 对适用的 API、事件、数据库、配置、测试、CSS、Shell 或 Worker 专项逐项审阅。
11. 仅运行项目已有且与结论直接相关的定向验证。
12. 为每个重要结论加证据标签和证据编号。
13. 执行模块反向自检。
14. 完成 5% 或 15% 的入口重追踪抽检；P0/P1/G3/GX 进入 100% 独立复核队列。
15. 更新 01–12 汇总报告中适用部分和 10-coverage-manifest.csv。
16. 重新对账文件数、状态数和代码行。
17. 列出 staged 文件，确认全部位于审计目录。
18. git diff --cached --check。
19. 按 docs(audit): complete <模块名称> review 提交。
20. 报告结果并停止。

## 6. 证据取得顺序

每个 AU 优先按以下顺序取证：

1. 当前基线入口和注册代码。
2. 构建、包导出、路由、Worker、systemd、工作流和迁移执行配置。
3. 直接与间接调用链。
4. 数据库对象、契约、事件和配置消费者。
5. 定向测试及反事实可信度。
6. 生产只读状态或日志，仅在当前结论确实需要且不改变状态时。
7. Git 历史，用于解释难以理解的设计。
8. 文档，用于比对、冲突和历史责任。

不得从文档结论反向选择性搜索代码。任何删除或“无使用”结论都要至少两类独立证据。

## 7. 审计目录与记录拓扑

顶层汇总制品保持原约定：

| 文件 | 内容 |
| --- | --- |
| 00-baseline.md | 固定基线、范围和初始库存 |
| 00-audit-plan.md | 阶段、顺序、检查点和完成闸门 |
| 00-review-record-schema.md | 文件、符号、函数及专项记录规范 |
| 01-architecture.md | 宏观真实架构与边界 |
| 02-runtime-map.md | 页面、API、服务、Worker、数据和部署关系 |
| 03-module-inventory.md | 模块职责、入口、依赖、所有权和覆盖 |
| 04-findings.md | F 编号问题 |
| 05-dead-code-candidates.md | DC 编号 G0–GX 候选 |
| 06-security-and-permissions.md | 身份、会话、权限和凭据边界 |
| 07-data-and-migrations.md | 数据所有权、事务、迁移和数据库矩阵 |
| 08-tests-and-quality.md | 测试用例可信度与质量缺口 |
| 09-release-and-operations.md | GitHub、阿里云、制品、Shell 和恢复 |
| 10-coverage-manifest.csv | 全仓文件唯一总账 |
| 11-remediation-roadmap.md | 后续独立小批次治理顺序 |
| 12-final-summary.md | 最终结果、未知项和完成闸门 |

每个 AU 在 records/AU-编号-模块名 下建立所需记录：

- evidence.csv
- files.csv
- exports.csv
- functions.csv
- branches-and-states.md
- apis.csv
- events-and-jobs.csv
- invariants.csv
- configuration.csv
- tests.csv
- communications.csv
- fmea.csv
- history.md
- review-sample.csv
- summary.md

不适用的记录文件不创建；summary.md 必须解释为何不适用。汇总报告只引用记录，不复制全部微观明细。

## 8. 阶段顺序

### 阶段 0：基线与方法

状态：已完成。

- CP-00：基线、初始入口库存和覆盖总账，已完成。
- CP-00A：微观记录规范、证据标签和执行计划，已完成。

验收：分支固定；覆盖清单与 4,238 基线文件逐项一致；计划覆盖补充协议全部专项。

### 阶段 1：宏观真实架构

架构阶段先于任何垃圾代码判断，拆成独立 AU：

1. AU-001：仓库入口与 package/export/build 发现机制，已完成（CP-01）。
2. AU-002：Console、Auth、Storefront、Miniapp 页面与运行入口总图，已完成（CP-02）。
3. AU-003：Canonical API、Jobs、Ready 与 Migration 进程入口总图，已完成（CP-03）。
4. AU-004：release target、systemd、Cloudflared、Caddy、静态制品和节点部署总图，已完成（CP-04）。
5. AU-005：PostgreSQL、Redis、对象存储、Secrets/KMS、队列和共享数据总图，已完成（CP-05）；同时完成API/事件/共享数据库初始通信矩阵、数据/恢复所有权矩阵与故障传播骨架。

每个 AU 只完成一张可复核图及对应证据，不在同一会话深审业务实现。

阶段输出：01-architecture.md、02-runtime-map.md、03-module-inventory.md 的可验证初版。只有阶段 1 完成，才能进入模块深审。

### 阶段 2：契约、基础设施包与共享内核

按依赖方向逐个 AU 审阅：

1. config，已完成（AU-006/CP-06）。
2. contract definitions 与 contractgen，已完成（AU-007/CP-07）。
3. contract runtime 输出生成链，已完成（AU-008/CP-08）。
4. sdk 与 API client，已随生成制品真实消费链完成（AU-008/CP-08）。
5. kernel，已完成（AU-009/CP-09）。
6. authz，下一候选单元。
7. smart-wing-authz。
8. api-contract。
9. telemetry。
10. interaction。
11. design 与 design-system。
12. testing package。
13. Commerce foundation/application/interface/persistence/cache/infrastructure。
14. Commerce bootstrap、entry、module catalog 和 runtime composition。

每个 package 或明确子边界独立提交。生成输出不逐行评风格，但要验证生成器、权威输入、漂移检查和消费者。

### 阶段 3：身份、会话、成员与权限链

按真实调用链拆分：

1. Auth Web 启动与登录表单。
2. Identity API 路由与会话创建。
3. Ticket exchange、Cookie 与跨域。
4. Session 读取、刷新、退出和多标签页。
5. Membership、Scope 与节点上下文。
6. Role、Capability、Access Version 和前后端缓存。
7. Owner、管理员、成员及转让/邀请。
8. Step-Up 与高风险操作。
9. 数据库角色、Execute、RLS 与身份执行上下文。
10. Identity notification jobs。
11. 身份链 FMEA 和登录故障矩阵。

涉及 identity、access、capability、member、organization、verification 和 qualification 的结论按模块分别形成检查点，不混成一次提交。

### 阶段 4：Commerce 业务模块

35 个模块目录全部进入独立模块审计，默认顺序依据调用依赖调整：

1. runtime。
2. identity。
3. access。
4. capability。
5. organization。
6. member。
7. mall。
8. provisioning。
9. partner。
10. qualification。
11. verification。
12. catalog。
13. inventory。
14. pricing。
15. channel。
16. extension。
17. purchase。
18. cart。
19. checkout_jiesuan。
20. order_dingdan。
21. payment_zhifu。
22. fulfillment。
23. voucher。
24. benefit。
25. finance。
26. referral。
27. reporting。
28. support。
29. notification。
30. audit。
31. risk。
32. observability。
33. experience。
34. marketing。
35. webbusiness。

基线目录实际为 35 个，上表逐项覆盖全部目录。架构阶段仍需确认每个目录的代码边界是否与运行、数据和发布边界一致，但不得为了减少审计单元而提前合并。

每个模块至少完成职责、入口、依赖、数据所有权、API/事件、进程、发布单元、测试、不变量、状态机、失败/并发/恢复和文件微观记录。

### 阶段 5：供应商、渠道和支付扩展

extensions 下每个实际 workspace 单独建档：

- providers：book、cake、core、directcharge、flower、foodvoucher、jdfresh、jdproduct、meal、movie、private、tmallmarket。
- vendors：cakeuncle、core、jd、tmall、wanlian、wenxuan。
- payment：wechat。

重点审外部调用、超时、重试、幂等、签名、回调、金额、状态映射、日志、凭据引用和兼容职责。不得把“当前没有测试调用”直接判为无外部消费者。

### 阶段 6：前端页面、状态、CSS 与可访问性

Console：

- app/providers、runtime config、session loader、scope shell、module registry 和错误恢复各为基础 AU。
- 15 个已注册 Console 模块逐模块审，不把所有 feature 混在一个检查点。
- importing、member、notification、profile 等未在顶层 registry 直接出现的目录，先追踪间接路由和消费者，再决定归属。

Auth：

- 启动、身份节点配置、用户/管理员界面、表单、Cookie 回调和错误态。

Storefront：

- vinext App Router、worker 同源 API、设备路由、H5、desktop、数据获取、缓存、CSS 和静态资源。

Miniapp：

- 先确认真实构建/发布/外部项目入口；证据不足时保持 UNKNOWN。

真实视觉对照只在 CSS、页面挂载、响应式或可访问性结论需要时执行，不为纯逻辑审计截图。

### 阶段 7：异步任务、事件和 Worker

1. runtime.job、JobRunner、Scheduler、Lease、Inbox/Outbox 和 dead letter 基础链。
2. app/jobs.ts 的 33 个注册逐个映射生产者与消费者。
3. identity-notification-jobs。
4. catalog-jobs。
5. payment-jobs。
6. FullJobs/JobsMain 等聚合或兼容入口。
7. 每个领域 Job 与外部副作用。
8. 消息版本、新旧进程、积压、告警和人工重放。

每条关键异步链完成全部崩溃点推演；不在生产制造故障。

### 阶段 8：数据库、迁移与数据所有权

1. 先建立 Canonical 和 Compatibility schema/object/owner/role 总图。
2. 300 个 Canonical 迁移按数据所有者和连续目的分批。
3. 57 个 Compatibility 迁移单独审，不与 Canonical 混批。
4. 每个迁移有独立记录；权限、RLS、SECURITY DEFINER、Owner 或执行身份变化标高风险。
5. 核对 current.sql、history.json、ledger、release migration executor 与 systemd migration 的一致性。
6. 建立表、函数、RLS、角色、服务账户和迁移身份六个矩阵。
7. 只运行与当前迁移结论有关的定向 fixture；全量重放保留到最终收口且最多一次。

任何权限删除建议一律 GX，不进入普通清理。

### 阶段 9：发布、运行与供应链

独立 AU：

1. deploy.yml。
2. deploy-oss.yml。
3. quality.yml。
4. scripts/deploy-now.sh。
5. release engine plan。
6. build/package。
7. install/deploy/remote agent。
8. activate-console-static.sh。
9. systemd production units。
10. staging units。
11. Caddy、Cloudflared 和节点运行配置。
12. OSS/SSH transport 和不可变制品。
13. current/previous 指针、并发锁和回滚。
14. package manifests、lockfile、许可证、隐式/重复依赖。
15. 发布 FMEA。

生产核验只读，严格区分仓库声明、候选状态和线上现状。

### 阶段 10：测试可信度

测试与生产模块同步审阅；本阶段再做全局收口：

- 536 个 test 文件、40 个 spec 文件、64 个 SQL 测试全部关联到生产职责。
- 关键测试按用例建立记录和反事实问题。
- 核对 Vitest、Node test、Playwright、PostgreSQL fixture、component、journey、security、performance、recovery 和 release-engine 边界。
- 检查错误 workspace 名、假阳性、mock、全局污染、Timer/env 恢复、执行顺序和生产注册证明。
- 未有对应测试的生产分支明确登记，不自动补测试。

### 阶段 11：文档、AI 指令与历史

- AGENTS.md、README、DEPLOYMENT、SOURCE-MANIFEST、LAW、CLAUDE、AI-DELIVERY。
- 当前架构、运维、权限、迁移、验收、事故、Prompt 和代码强制注释。
- 自动读取、权威声明、运行支持、冲突、过期、阻塞和回滚责任。
- 视觉 version-upgrades、Storybook preview 和设计参考的归档/外部依赖责任。

文档零运行引用不构成删除依据。

### 阶段 12：垃圾代码候选

只有前述架构、运行、模块、数据、发布、外部消费者和历史证据完成后才开始。

1. 汇总所有疑似闲置文件和符号。
2. 逐项应用 G0–GX 标准。
3. G3 必须有两类独立证据、可观察行为不变证明、验证和恢复方法。
4. G3、GX 进入 100% 独立复核。
5. 本分支只记录，不删除。

### 阶段 13：独立复核、抽检和最终收口

- 普通模块 5%、高风险模块 15% 入口重追踪。
- P0、P1、G3、GX 100% 独立复核。
- 独立复核在不同会话中先重新追踪入口，再查看原结论；不得复述。
- 若无法安排真正独立的第二审阅者，相关项保持“需要独立复核”，不得关闭。
- 执行一次最终全量验证；失败只记录。
- 对账全部文件、行数、API、Worker、迁移、配置和权限矩阵。
- 所有未知项明确标 UNKNOWN。
- 完成 11-remediation-roadmap.md 和 12-final-summary.md 后停止。

## 9. 模块检查点验收

一个模块只有同时满足以下条件才可关闭：

1. 模块范围和文件集合与覆盖总账一致。
2. 所有人工文件完成 29 项 FILE 记录。
3. 全部导出符号登记。
4. 关键函数和方法完成 30 项记录。
5. 大文件所有逻辑区域已读。
6. 入口、动态注册、构建和运行进程已追踪。
7. API、事件、数据、配置、权限和测试已关联。
8. 正常、失败、并发和恢复已分析。
9. 重要状态机和不变量已建表。
10. 重要结论有证据标签和编号。
11. UNKNOWN 与 CONFLICT 未被伪装为事实。
12. 抽检达到比例且无未处理系统性遗漏。
13. P0/P1/G3/GX 已进入独立复核队列。
14. 覆盖清单和汇总报告已更新。
15. staged diff 只有该模块审计文档。

缺任一项，模块状态只能是“进行中”或“需要专项专家复核”。

## 10. P0 停止协议

发现疑似 P0 时：

1. 只完成最小只读复核，确认不是单一文本或错误闸门造成的假象。
2. 记录当前行为、入口、影响范围、证据、未知项和不改变状态的复现方式。
3. 不继续读取其他模块，不修复、不缓解、不部署。
4. 不等待常规检查点收口，立即向 Ethan 报告。
5. 未获授权前停止。

如果 P0 证据仍不足，标 HYPOTHESIS 或 UNKNOWN，不夸大为事故。

## 11. 测试与运行纪律

- 先使用根 package.json 或 workspace package.json 已声明入口。
- 每个 AU 只运行与结论直接相关的最小测试。
- 不用测试通过替代生产入口证明。
- 不用测试失败直接证明生产缺陷。
- 不因失败扩展成修复任务。
- 数据库全量重放和完整 production build 在最终收口最多各一次。
- 线上服务只允许状态、日志、指针、哈希和只读查询，不改变状态。
- UI 只有在视觉、CSS、路由挂载或可访问性结论需要时打开真实页面。

## 12. 覆盖与进度计算

每个检查点报告：

- 基线文件总数 4,238。
- 各覆盖状态文件数。
- 人工源码已深入审阅文件数和物理行数。
- 人工配置已深入/结构审阅数。
- 生成、第三方、构建、归档的已验证来源数。
- 当前模块总文件、已审文件、已审行数。
- API、Worker、迁移、配置、权限和测试记录完成数。
- UNKNOWN、CONFLICT、P0–NIT、G0–GX 数量。
- 抽检分母、样本数和结果。

覆盖率不得只按文件数。至少同时报告：

1. 文件覆盖率。
2. 人工源码物理行覆盖率。
3. 运行入口覆盖率。
4. API 覆盖率。
5. 迁移覆盖率。
6. 配置覆盖率。
7. 权限能力覆盖率。

## 13. 会话续接模板

每个新会话提示必须包含：

- 固定基线 SHA。
- 审计分支和 worktree。
- 上一个检查点中文名称与 SHA。
- 本次唯一 AU 编号和目的。
- 允许读取文件/目录。
- 允许写入的审计记录。
- 禁止修改范围。
- 入口与验收判据。
- 预计时间和 90 分钟停止条件。
- P0 停止规则。
- 不推送、不合并、不部署。

新会话先读 00-baseline.md、00-audit-plan.md、00-review-record-schema.md、上一个 AU summary 和覆盖清单中的本模块行，不从头重扫。

## 14. 补充协议覆盖矩阵

| 补充协议主题 | 本计划承载位置 |
| --- | --- |
| 证据类型 | 记录规范第 3–4 节 |
| 逐文件 | FILE 29 字段；records/files.csv |
| 逐导出 | SYM 12 字段；records/exports.csv |
| 逐函数 | FN 30 字段；records/functions.csv |
| 条件与状态机 | branches-and-states.md |
| TypeScript/JavaScript | FILE/FN 附加检查 |
| React/CSS/可访问性 | 阶段 6 与记录规范第 9 节 |
| Node/API | records/apis.csv；阶段 1、3、4 |
| 业务不变量 | records/invariants.csv |
| PostgreSQL/Supabase/迁移 | 阶段 8 与六个矩阵 |
| 异步/队列/Worker | 阶段 7 与 events-and-jobs.csv |
| 身份/会话/权限 | 阶段 3 与 06-security-and-permissions.md |
| GitHub/供应链 | 阶段 9 |
| Shell/部署 | 阶段 9，逐行审 |
| 配置/环境变量 | records/configuration.csv 与全局 CFG 矩阵 |
| 测试用例 | records/tests.csv 与阶段 10 |
| 文档/契约/AI | 阶段 11 |
| 跨模块通信 | communications.csv、01/02 架构图 |
| FMEA | fmea.csv 及各关键链路 |
| Git 历史 | history.md |
| 反向自检 | 每个 AU 第 13 步 |
| 抽检 | review-sample.csv、阶段 13 |
| 完成条件 | 记录规范第 24 节与阶段 13 |

## 15. 初始工作量估算

| 范围 | 预计 AU |
| --- | ---: |
| 宏观架构与运行图 | 6–10 |
| 共享包、生成链和 Commerce foundation | 18–32 |
| 身份、会话与权限链 | 12–24 |
| Commerce 业务模块 | 40–75 |
| 供应商、支付扩展 | 19–30 |
| 前端页面、状态、CSS、可访问性 | 25–45 |
| 异步任务、事件和 Worker | 12–24 |
| 357 个迁移与数据库矩阵 | 20–40 |
| 发布、运维与供应链 | 14–24 |
| 测试、文档、垃圾候选和最终复核 | 20–40 |
| 初始合计 | 186–344 |

该估算偏保守，且部分 AU 会同时完成模块代码、对应测试和迁移记录；架构阶段结束后按真实边界去重。不得为了追求较小 AU 数量降低微观深度。

## 16. AU-009 已执行范围

CP-08 提交后结束当前单一目的会话。后续只有在 Ethan 明确授权时才执行：

- AU-009：`@shop/kernel` 共享内核。
- 目的：逐文件核对内核公开入口、调用者、标识/时间/哈希等基础语义、失败传播和测试契约；不同时展开 authz、业务模块或数据库实现。
- 输入：CP-08 的生成契约运行图、SDK 边界、问题清单、106 文件 AU 覆盖记录、覆盖总账与 RV-0008 独立复核队列。
- 禁止：修复 F-0044–F-0046 或既有问题，修改任何源码/配置/依赖，安装依赖，改变线上状态，推送或部署。

执行结果：40/40 Kernel文件深入审阅；新增F-0047–F-0052、DC-0010–DC-0011，并补强F-0032/F-0037。正式test/typecheck因本地依赖缺失在源码加载前阻塞；未安装依赖、未修复、未推送、未合并、未部署。

## 17. AU-010 已执行范围

CP-09提交后由Ethan明确授权执行：

- AU-010：`@shop/authz` 权限决策内核。
- 目的：逐文件核对permission/scope/role/decision公开入口、调用者、拒绝/默认分支、缓存与测试契约；从真实AccessPipeline消费者反追，但不同时审`smart-wing-authz`或业务模块权限。
- 输入：CP-09 Kernel边界、Gate observe结论、既有F-0036/RV-0008权限候选、覆盖总账与AU-009 UNKNOWN。
- 禁止：修复任何权限映射、增加/收窄安全约束、修改源码/配置/迁移/依赖，安装依赖，改变线上状态，推送或部署。

执行结果：10/10 Authz文件、397/397行深入审阅；184 permission与329个受保护Operation完全闭合；新增F-0053–F-0059与DC-0012，并补强F-0032/F-0036。正式test/typecheck因本地依赖缺失在源码加载前阻塞；未安装依赖、未修复、未推送、未合并、未部署。

## 18. AU-011 已执行范围

CP-10提交后结束当前单一目的会话。后续只有在Ethan明确授权时才执行：

- AU-011：`@smart-wing/authz` 第二套权限决策内核。
- 目的：逐文件核对另一套Membership/Permission/ResourceScope/step-up判定、其Commerce API真实调用者与`@shop/authz`的边界；不得先假定两套等价、互为替代或任一可删除。
- 输入：CP-10 Authz运行图、F-0053–F-0055、DC-0012、两套授权消费者矩阵、覆盖总账和RV-0008/RV-0009队列。
- 禁止：合并两套权限实现、修复、删除、修改源码/配置/迁移/依赖，安装依赖，改变线上状态，推送或部署。

执行结果：4/4文件、267/267行深入审阅；确认兼容Authz与canonical Authz只共享8个permission code且数据/运行模型不同；新增F-0060–F-0062与DC-0013，并补强F-0032/F-0053。本包直接test/typecheck命令因没有对应script而失败；根`test:unit`会经Storefront Vitest配置间接收录13个用例，根`typecheck`则不会执行本包独立tsconfig。未安装依赖、未修复、未推送、未合并、未部署。

## 19. AU-012 已执行范围

CP-11A完成AU-011证据纠错后，Ethan授权后续审计单元连续推进，仅确认P0时中断：

- AU-012：`@smart-wing/api-contract` 兼容共享契约。
- 目的：逐文件核对permission/Authz类型、支付状态、会员码、platform adapter、商品taxonomy和delivery matrix，以及第一层真实消费者。
- 输入：AU-011兼容Authz边界、Storefront测试聚合、兼容Commerce路由、数据库taxonomy code与正式delivery checker。
- 禁止：修复、删除、修改源码/测试/配置/迁移/依赖，安装依赖，改变线上状态，推送、合并或部署。

执行结果：11/11文件、758/758行深入审阅；新增F-0063–F-0064、DC-0014–DC-0015，并补强F-0032/F-0060。确认delivery matrix与正式闸门脱节、taxonomy一个父链缺口、86权限目录闭合以及支付映射真实调用。本包直接test/typecheck缺script，根测试仅经Storefront间接聚合；未安装依赖、未修复、未推送、未合并、未部署。

## 20. 下一连续审计点

CP-12后继续选择一个边界清晰的共享包或完整链路，先核对文件数、人工行数、入口和消费者，再逐文件深审。只有确认P0才中断报告；P1及以下继续记录并进入下一批。Knip、全仓深扫和任何修复仍不是审计单元替代品。

执行结果：AU-013完成`@shop/telemetry` 18/18文件、473/473行深审；新增F-0065/P1候选、F-0066/P2、F-0067/P3和DC-0016–DC-0017，补强F-0055。正式test/typecheck因本地缺vitest/tsc在源码加载前阻塞；未安装依赖、未修复、未推送、未合并、未部署。

## 21. AU-014 连续审计点

CP-13后自动选择下一边界清晰的共享包或完整链路并继续；P1及以下只入账，只有确认P0才中断。固定基线和只写审计制品边界不变。

执行结果：AU-014完成`@shop/testing` 20/20文件、403/403行深审；新增F-0068–F-0069与DC-0018–DC-0019，补强F-0052。正式test/typecheck因缺vitest/tsc在源码加载前阻塞；未连接测试数据库、安装依赖、修复、推送、合并或部署。

## 22. AU-015 连续审计点

CP-14后继续下一个边界清晰模块；仅P0中断，其他等级持续入账。

执行结果：AU-015完成`@shop/interaction` 14/14文件、971/971行深审；新增F-0070–F-0073，无垃圾候选。正式test/typecheck因缺vitest/tsc在源码加载前阻塞；未安装依赖、修复、推送、合并或部署。

## 23. AU-016 连续审计点

CP-15后继续下一个边界清晰模块；仅P0中断，其他等级持续入账。

执行结果：AU-016完成旧design-system 8/8文件审阅；新增F-0074–F-0075与DC-0020/G2。包无test/typecheck script，canonical token check通过但不覆盖旧包；未修复、删除、推送、合并或部署。

## 24. AU-017 连续审计点

CP-16后继续下一个边界清晰模块；仅P0中断，其他等级持续入账。

执行结果：AU-017完成canonical design 67/67文件审阅；新增F-0076–F-0081与DC-0021–DC-0022。确认Console生产CSS存在80个未定义token、AccessDenied零样式定义、401恢复状态折叠、Storybook样式/执行入口缺口及品牌/跨端规格漂移。正式test/component/typecheck因缺vitest/tsc在源码加载前退出；未安装依赖、打开线上页面、修复、删除、推送、合并或部署。

## 25. AU-018 连续审计点

CP-17后继续下一个边界清晰模块；仅P0中断，其他等级持续入账。

执行结果：AU-018完成Miniapp片段9/9文件复核；新增F-0082与DC-0023，补强F-0006/F-0032/F-0033/F-0080/F-0081。navigation仍因app.json缺失失败而test topology通过；生成Experience parser与canonical限制/归一化不一致。未安装依赖、访问外部工程、打开微信工具、修复、删除、推送、合并或部署。

## 26. AU-019 连续审计点

CP-18后继续下一个边界清晰模块；仅P0中断，其他等级持续入账。

执行结果：AU-019完成Auth Web 58/58文件、6,807/6,807行审阅；新增F-0083/P1候选、F-0084–F-0087/P2、F-0088–F-0090/P3、DC-0024–DC-0025/G1和GX-0002。正式test/typecheck因缺vitest/tsc在源码加载前阻塞；未安装依赖、build、读取live runtime、修复、删除、推送、合并或部署。

## 27. AU-020 连续审计点

CP-19后自动选择微信支付APIv3适配器，覆盖配置、密码学、Transport、Client、通知、模型、测试以及三个生产runtime和支付领域consumer。

执行结果：AU-020完成18/18文件、1,873/1,873行深入审阅；新增F-0091–F-0092/P2与F-0093/P3。正式test/typecheck因缺vitest/tsc在源码加载前阻塞；合成密钥和本地响应流探针分别复现密钥预检与正文超时传播缺口。未安装依赖、build、访问微信/secret/线上、修复、删除、推送、合并或部署。

## 28. AU-021 连续审计点

CP-20后自动选择Provider Core，覆盖Provider生命周期、installation契约、通用ports/mapper/errors/limits、Webhook及生产loader/registry/route/DB/job链。

执行结果：AU-021完成11/11文件、354/354行深入审阅；新增F-0094/P1候选、F-0095/P3、DC-0026/G1和RV-0013。正式test/typecheck因缺vitest/tsc在源码加载前阻塞；签名材料与数据库去重链证明event ID未绑定。未安装依赖、连接provider/数据库、修复、删除、推送、合并或部署。

## 29. AU-022 连续审计点

CP-21后自动选择Vendor Core，覆盖连接、认证、签名、Client、限流/并发/断路器、错误、测试以及Channel配置到具体vendor消费者链。

执行结果：AU-022完成11/11文件、365/365行深入审阅；新增F-0096–F-0097/P1候选、F-0098/P3、DC-0027/G1及RV-0014/RV-0015。正式test/typecheck因缺vitest/tsc在源码加载前阻塞。未安装依赖、连接provider/secret/数据库、修复、删除、推送、合并或部署。

## 30. AU-023 连续审计点

CP-22后自动选择Cakeuncle Vendor，覆盖认证、签名、Client、容量/超时、Webhook、endpoint/金额工具、测试以及Cake/Flower/Foodvoucher/Meal直接消费者。

执行结果：AU-023完成16/16文件、662/662行深入审阅；新增F-0099/P2、F-0100/P1候选、F-0101–F-0102/P3、DC-0028/GX、DC-0029/G1及RV-0016/RV-0017。正式test/typecheck因缺vitest/tsc在源码加载前阻塞；合成深层JSON复现递归栈溢出。未安装依赖、连接Cakeuncle/secret/数据库、修复、删除、推送、合并或部署。

## 31. AU-024 连续审计点

CP-23后自动选择Foodvoucher Provider，覆盖manifest、factory、Mapper/Error/Webhook转发、测试、Registry capability-port关系、真实静态caller和历史专用适配来源。

执行结果：AU-024完成9/9文件、79/79行深入审阅；收窄并补强F-0100/P1候选，新增F-0103/P1候选、F-0104/P3、DC-0030/G1及RV-0018。正式test/typecheck因缺vitest/tsc阻塞；没有P0证据。未安装依赖、连接Cakeuncle/数据库/线上、修复、删除、推送、合并或部署。

## 32. AU-025 连续审计点

CP-24后自动选择Cake Provider，覆盖分类/商品映射、分页、Price/Stock快照、禁用Order、manifest、测试及Channel任务consumer。

执行结果：AU-025完成13/13文件、807/807行深入审阅；新增F-0105–F-0106/P2、F-0107/P3、DC-0031/GX、DC-0032/G1和RV-0019。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 33. AU-026 连续审计点

CP-25后自动选择Flower Provider，覆盖分类/商品映射、分页、Price/Stock快照、manifest、测试及Channel/Catalog consumers。

执行结果：AU-026完成10/10文件、548/548行深入审阅；新增F-0108–F-0110/P2、F-0111/P3、DC-0033/G1。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 34. AU-027 连续审计点

CP-26后自动选择Meal Provider，覆盖七品牌门店scope、Catalog/Price、Mapper、禁用Order/Webhook、依赖和测试。

执行结果：AU-027完成12/12文件、507/507行深入审阅；新增F-0112/F-0113 P2、F-0114/F-0115 P3、DC-0034/GX、DC-0035/G1。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 35. AU-028 连续审计点

CP-27后自动选择Book Provider，覆盖Wenxuan传输、Catalog/Price/Inventory、Order/Tracking/Return、Webhook、能力配对和测试。

执行结果：AU-028完成9/9文件、79/79行深入审阅；新增F-0116/P1候选、F-0117/P2、F-0118/P3、DC-0036/G1和RV-0021。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 36. AU-029 连续审计点

CP-28后自动选择Directcharge Provider，覆盖万联传输、Catalog/Issue/Query/Refund/Verify、核心履约caller、能力配对和测试。

执行结果：AU-029完成9/9文件、79/79行深入审阅；新增F-0119/P1候选、F-0120/P2、F-0121/P3、DC-0037/G1和RV-0022。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 37. AU-030 连续审计点

CP-29后自动选择Jdfresh Provider，覆盖JD传输、库存、订单、物流、TimeSlot、能力配对和测试。

执行结果：AU-030完成9/9文件、79/79行深入审阅；新增F-0122/P1候选、F-0123/P2、F-0124/P3、DC-0038/G1和RV-0023。正式test/typecheck因缺工具阻塞；无P0。

## 38. AU-031 连续审计点

CP-30后自动选择Jdproduct Provider，覆盖JD映射与provider ports、manifest能力、channel/fulfillment consumer、provider test与零调用候选。

执行结果：AU-031完成9/9文件、79/79行深入审阅；新增F-0125/P2、F-0126/P3、DC-0039/G1。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 39. AU-036 连续审计点

CP-35后自动选择JD Vendor Adapter，覆盖 Auth/Client/转发导出和测试。

执行结果：AU-036完成8/8文件、33/33行深入审阅；新增F-0134/P3和DC-0043/G1。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 40. AU-037 连续审计点

CP-36后自动选择Wanlian Vendor Adapter，覆盖 Auth/Client/转发导出和测试。

执行结果：AU-037完成9/9文件、45/45行深入审阅；新增F-0135/P3和DC-0044/G1。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 41. AU-038 连续审计点

CP-37后自动选择Wenxuan Vendor Adapter，覆盖 Auth/Client/转发导出和测试。

执行结果：AU-038完成9/9文件、45/45行深入审阅；新增F-0136/P3和DC-0045/G1。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 42. AU-039 连续审计点

CP-38后自动选择Movie Provider，覆盖 manifest/Provider/Mapper/Webhook/ErrorMap/tests、errors 和入口映射。

执行结果：AU-039完成9/9文件、79/79行深入审阅；确认既有F-0130/F-0131/F-0132边界，未新增P1/P2/P3项。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 43. AU-040 连续审计点

CP-39后自动选择Tmallmarket Provider，复核 manifest/Provider/Mapper/Webhook/ErrorMap/tests 与 provider 注册链，核对既有结论闭环。

执行结果：AU-040完成9/9文件、79/79行深入审阅；确认既有F-0130/F-0131边界未新增P1/P2/P3项。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 44. AU-041 连续审计点

CP-40后自动选择Private Provider，复核 manifest/Provider/local适配器与provider注册链路。

执行结果：AU-041完成9/9文件、79/79行深入审阅；确认既有F-0127/F-0128/F-0129边界，未新增P1/P2/P3项。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 45. AU-042 连续审计点

CP-41后自动选择Vendor公共配置（`extensions/vendors/*/tsconfig.json`），复核继承关系与发布/测试作用域。

执行结果：AU-042完成4/4文件结构性审阅；未发现独立缺陷。正式test/typecheck因缺工具阻塞；无P0。未修复、删除、推送、合并或部署。

## 46. AU-044 连续审计点

AU-002/CP-02 与 CP-19 的基础入口图后，补充 `settings/members` 与 `services/commerce` 的 access 链路深审。

执行结果：AU-044完成32个关键源文件/测试文件的深入审阅；确认 `settings/members` 与 `settings/profile` 共享 `AccessQuery` 查询契约，并复核到服务端 `AccessReadOperations.queryPage` 的 keyset 返回与 `nextCursor`。二次收窄既有 F-0137（P3）：查询函数支持 cursor，但 profile、权限中心和成员页的 access 补充数据未形成 `access.center.read` 的连续取页闭环；大规模成员场景下可能出现身份/角色补充信息不完整。正式test/typecheck因缺vitest/tsc在源码加载前阻塞；未安装依赖、连接数据库/线上、修复、删除、推送、合并或部署。

## 47. AU-045 连续审计点

AU-044 后选择 `qualification` 的完整业务链：Console 只读策略页 → SDK/契约 → Commerce runtime → 策略版本数据 → checkout QuoteReader。

执行结果：深入审阅14个核心手写源文件/迁移和跨模块消费者；新增 F-0138/P1（策略管理未消费条件版本）、F-0139/P2（预览与结算规则不一致）和 F-0140/P2（公开管理 API 无法表达 checkout 的完整策略）。正式 test/typecheck 因固定审计工作树缺包级 vitest/tsc 未执行；未安装依赖、连接数据库/线上、修复、删除、推送、合并或部署。

## 48. AU-046 独立复核点

对 F-0138 从 HTTP 输入、幂等范围和同类 `PartnerOperations` 的条件版本语义重新追踪。

执行结果：复核一致，将 F-0138 定级为 P1（高置信度）：两个不同幂等键、相同 If-Match 的策略管理请求可无冲突地依次替换 active version。未见 P0 线上事故证据；未运行数据库、修复、推送、合并或部署。

## 49. AU-047 连续审计点

审阅 Console 报表入口、reporting HTTP/read 链、projection/export job、持久化和对象完成条件。

执行结果：新增 F-0141/P2（XLSX 导出累计全部行、无资源上界）；投影事务与对象校验闭环已记录。未发现 P0；正式测试因缺包级 vitest 未执行，未安装依赖或改变运行状态。

## 50. AU-048 连续审计点

审阅 Support Console、工单/消息事务、附件扫描和 SLA 作业。

执行结果：新增 F-0142/P2（消息发送 expectedVersion 契约与实现不一致）；未发现 P0，未运行正式测试或改变运行状态。

## 51. AU-049 连续审计点

审阅 Notification Console 只读入口、模块/Job 注册、事件入队、偏好/端点、渠道适配器及失败重试。

执行结果：新增 F-0143/P1 候选：generic dispatch 领取后、外发前的 KMS/模板异常会保留 `sending`；JobRunner 重试时领取为空并将 runtime job 完成，通知无恢复入口。已保存完整静态证据，按 P1 纪律进入 AU-050 独立复核；未见 P0，定向 Vitest 因缺命令未启动，未安装依赖或改变运行状态。

## 52. AU-050 独立复核点

从 runtime 领取函数、迁移历史、JobRunner 和 identity 专用监控重新追踪 F-0143，不复用 AU-049 的推导。

执行结果：复核一致，F-0143 定级 P1（高置信度）。`runtime.claim_job` 仅重领 queued，notification.dispatch 没有 sending lease/recovery SQL，identity 的积压告警也不覆盖 generic notification；因此前置失败后的第二次 job 会空领取并完成。未见正在发生的线上事故、数据损失或安全事故，故不是 P0；未改变运行状态。

## 53. AU-051 连续审计点

审阅 audit 记录写入、scope hash chain、脱敏、read operation、archive bootstrap/worker/对象恢复及真实运行时绑定。

执行结果：438 行 audit 模块文件完成关键逻辑审阅；归档 bootstrap、受控不可变删除、对象验证与续排链均存在，Console 经 access 历史间接消费。未发现 P0–P3 新问题；正式 Vitest 未启动（缺命令），未安装依赖或改变运行状态。

## 54. AU-052 连续审计点

审阅 risk 的 API 判定、策略 candidate/replay/activate、case review、catalog deny 作业与迁移边界。

执行结果：824 行风险模块文件纳入审阅。API context、scope hierarchy、事务案件锁、独立策略创建者、回放门槛和 riskscan 消费链均已确认；未发现 P0–P3 新问题。generic job 崩溃恢复沿用 F-0143，不重复计数；正式 Vitest 未启动且未改变运行状态。

## 55. AU-053 连续审计点

审阅 observability 平台模块、客户端错误 create/read、脱敏和 telemetry buffer 依赖。

执行结果：模块为刻意的 process-lived 客户端错误入口；成员组织 scope、operator scope filter、双层脱敏和不写 audit body 已确认。未发现 P0–P3 新问题；未运行 Vitest 或改变运行状态。

## 56. AU-054 连续审计点

审阅 Experience application/version/publish、公开读取、对象投影、Worker 激活、Identity 受限操作变体及其迁移/RLS 边界。

执行结果：922 行模块文件纳入审阅。V2 配置、版本条件、scheduled→active 投影、内容寻址对象验证、inbox 行锁与 application advisory lock 均有实现入口；新增 F-0144/P2（主发布事务/Worker 没有模块专用行为测试）。未发现 P0，未运行 Vitest 或改变运行状态。

## 57. AU-055 连续审计点

审阅 Marketing 公开读取、预算预留/提交/释放、checkout/order/payment 消费者与 RLS/数据库所有权。

执行结果：模块只公开活动读取，订单和支付通过 MarketingPort 管理 campaign/redemption 状态机；条件预算更新、交易调用点、jobscope 与 Purchase API 列权限已核对。新增 F-0145/P2（真实预算状态机没有模块专用行为测试）；未发现 P0，未运行 Vitest 或改变运行状态。

## 58. AU-056 连续审计点

审阅 Referral 设置、成员/绑定、订单事件、佣金结算、反冲、提现及 Finance 交界。

执行结果：inbox/outbox 事实锁、稳定佣金 ID、settlement row lock、会员提现串行锁、反冲与 Finance journal 交界均已核对；模块自有 policy/operation/event/settlement 测试覆盖主要分支。未发现 P0–P3 新问题，未运行 Vitest 或改变运行状态。

## 59. AU-057 连续审计点

审阅 Cart current/read、single put、batch、下单转换、数据约束与 WebBusiness 入口。

执行结果：single put 与 active-cart 唯一性/RLS 已闭合；新增 F-0146/P2：公开 batch 不能建立 cart 或插入新项目。未发现 P0，未运行 Vitest 或改变运行状态。

## 60. AU-058 连续审计点

审阅 Checkout 报价模型、handler、签名、session/evidence、完整 Commerce 与 Purchase API selected-module 运行时、地址默认约束与相应 RLS。

执行结果：两个运行时分别用完整 adapter 与 purchase-only adapter 调用共用报价/签名事实链；命令事务、幂等、quote/session/evidence/outbox、订单重验签和 member default 地址约束均已追踪。新增 F-0147/P2：两个真实报价 handler 的签名、会话、证据、outbox、重放、过期及 Purchase 边界没有专用行为测试。定向 Vitest 因固定审计 worktree 缺少 `vitest` 退出 127；未安装依赖、未修复、未改变运行状态。未发现 P0/P1。

## 61. AU-059 连续审计点

审阅 Order 创建、支付计划、供应事实快照、收货确认、售后、超时任务与 Purchase selected order runtime。

执行结果：订单创建的资源预留、订单/行/子单/支付、checkout/cart 转换、超时任务和 outbox 处于同一幂等命令事务；收货状态与事件幂等边界存在。新增 F-0148/P2：售后 line 未绑定目标 order，且 line 级缺省退款金额采用整笔支付余额。未发现 P0/P1；Vitest 仍因固定 worktree 缺少可执行文件未运行。

## 62. AU-060 连续审计点

审阅 Payment 意图计划、外部预下单、内部/混合捕获、读取、分摊、Wechat adapter 与 provider accounting time；webhook/refund/job 留作后续独立单元。

执行结果：外部未知结果、应用上下文、幂等、member+mall scope、tender 总额、资源提交、履约入队及 provider time 约束均已追踪；核心 mock oracle 覆盖上述关键分支。未发现 P0–P3 新问题；定向 Vitest 仍因 `vitest` 缺失未执行。

## 63. AU-061 连续审计点

审阅 Payment webhook、provider query/refund job、退款计划/结算、deadletter 与受控 recovery 操作。

执行结果：通知签名后的 target/inbox/job 边界、provider effect 封存、支付过期/晚到支付、退款资金恢复、供应售后回放与 deadletter 重放均已追踪。F-0148 获得退款执行链直接证据；新增 F-0149/P2：webhook、退款恢复和人工 recovery 缺少真实 handler/事务行为测试。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。
