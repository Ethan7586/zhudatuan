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

当前进度：CP-00、CP-00A、AU-001/CP-01 至 AU-143 已完成。AU-143 完成 Voucher 导入、发券、状态 Worker 与死信审阅。覆盖总账按当前文件级清单重算：深入审阅1,353文件/102,485行、结构性审阅805文件/118,449行、自动生成70文件/172,651行、暂未审阅1,500文件。F-0158/P1、F-0159/P1、F-0173/P1 均已双轮确认；按Ethan最新指令仅确认P0时中断，否则连续进入下一审计单元。

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

## 64. AU-062 连续审计点

审阅 Fulfillment 创建、供应商提交、tracking、人工 shipment、return receive/inspect 与供应售后回放。

执行结果：payment→fulfillment→provider/tracking→order received 的运行链已闭合；既有 F-0127 的 Logistics caller 关系复核不变。新增 F-0150/P2：provider submit 的失败或未知 state 仍被写成 accepted 并转 tracking，失去 submit retry。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 65. AU-063 连续审计点

审阅 Finance event inbox→journal、订单外部 tender 计提、支付/退款/晚到支付记账、取消反转与供应商售后会计回放。

执行结果：不可变 outbox 事实重查、inbox 行锁、journal 数据库幂等、取消精确反转和供应商售后固定会计时间均已追踪；未发现 P0–P3 新问题。定向 Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 66. AU-064 连续审计点

审阅 Finance 对账、结算、提现、发票与 deadletter job。

执行结果：对账 hash/CSV/差异、结算 frozen basis、payout idempotency、发票状态与 deadletter 收口均已追踪。新增 F-0151/P2：对账、发票、财务 deadletter 没有真实行为/失败恢复测试。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 67. AU-065 连续审计点

审阅 Finance period close、backfill 签核、lifecycle reads 与 HTTP 注册。

执行结果：周期的 source hash、不同请求/批准人、statement final/outbox，以及 backfill source/target 完整性条件均已追踪。新增 F-0152/P2：period/backfill 缺专用行为、并发及回滚测试。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 68. AU-066 连续审计点

审阅 Finance withdrawal 的 create、decide、recover 与 stable job replay。

执行结果：payable 余额、requester/approver separation、version、deadletter uncertain 与按 source kind 恢复路径均已追踪。新增 F-0153/P2：create/decide 缺余额、并发、四眼和失败恢复行为测试。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 69. AU-067 连续审计点

审阅 Finance invoice request 的 create/cancel/decide/red 与 member/operator reads。

执行结果：受管数据库过程、审批 stable job 与调用方读取范围均已追踪。新增 F-0154/P2：仅有创建 mock 测试，缺 cancel/decide/red/read 与真实过程验证。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 71. AU-069 连续审计点

审阅 Finance 结算 approve/reject、adjustment request/decision、权威快照派生/复核与真实数据库行为测试。

执行结果：结算版本/四眼/draft 行锁、来源/规则/冻结行/分账/调整/hash 全量复核、计提及 platform split paid 均已追踪；PGlite 测试覆盖调整、篡改拒绝、late-payment 排除和最终计提。未发现 P0–P3 新问题；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 72. AU-070 连续审计点

审阅 Finance 对账差异 retry/resolve/approve、受控 repair wrapper 和 scope read。

执行结果：reconciliation 状态、stable job、repair 的 strict body/idempotency/version/hash/read scope 均已追踪。新增 F-0156/P2：差异处置 manage command 缺专用行为测试；数据库 SECURITY DEFINER workflow 与 repository integration 留 AU-071。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 73. AU-071 连续审计点

审阅 Finance reconciliation repair 的数据库迁移、SECURITY DEFINER preview/submit/decide/reverse、RLS/注册及 PGlite repository 集成测试。

执行结果：权威 payment/refund 事实、source/target hash、action proof、四眼、journal/entry 精确核验、downstream lock、精确反转和底表 default-deny 均已追踪；PGlite 重放测试覆盖完整状态机及主要拒绝条件。未发现 P0–P3 新问题；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 74. AU-072 连续审计点

审阅 Finance overview 的组织范围、posted journal 聚合、会计方向、wire amount 和行为测试。

执行结果：查询仅对 scope 闭包内 posted journal 聚合资产/负债/收入/费用/cash；PGlite 覆盖 draft/reversed 排除、decimal text 与 watermark。未发现 P0–P3 新问题；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 75. AU-073 连续审计点

审阅 Finance entries/statement/export 读取、完整 Finance 与 Identity selected Finance 模块的同 operation 实现及路由注册测试。

执行结果：entries posted-only 边界已追踪；新增 F-0157/P2：同一 `finance.statements.read` 在两个运行模块中的 state/projection 条件不一致，且无等价性行为测试。未发现 P0/P1；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 76. AU-074 连续审计点

审阅 Finance 领域 model、PostingPolicy、SettlementPolicy 及领域测试。

执行结果：领域 shape、借贷平衡、结算四眼、金额/费率/invoice basis 和确定性 split 均已追踪；测试覆盖主要策略边界。未发现 P0–P3 新问题；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 77. AU-075 连续审计点

审阅 Finance capability、manifest、public index、全量/selected 模块注册和 manifest 测试。

执行结果：公开 read/manage、reporting 依赖、operation/event/job/http 声明和两个实际运行模块入口均已追踪；manifest 测试锁定相应契约。未发现 P0–P3 新问题；Vitest 仍因固定审计 worktree 缺少可执行文件未运行。

## 78. AU-076 连续审计点

审阅 Finance InvoiceGateway、InvoiceJobProcessor、jobs role/注册、迁移写边界与 integrity 测试。

执行结果：InvoiceJobProcessor 仍直接写发票核心表，但 canonical jobs role `shopjob` 已被迁移撤销相应写权且要求 claim/register/finalize 受控函数；完整签发测试明确 skip/未实现。新增 F-0158/P1 候选，立即进入 AU-077 独立复核。未发现 P0；未运行 Vitest 或改变运行状态。

## 79. AU-077 连续审计点

独立重查 F-0158 的迁移 grant/revoke chronology、jobs role、processor 绑定、受控函数权限和测试状态。

执行结果：未见 20260828094000 后重新授予 shopjob invoice 核心表写权；runtime 仍以 shopjob 运行 direct-SQL InvoiceJobProcessor；迁移断言明确禁止该边界。F-0158 确认为 P1。未发现 P0；未运行测试或改变运行状态。

## 80. AU-078 连续审计点

审阅 Finance invoice 完整性迁移的 API/job lifecycle、写边界和 PGlite repository integration test。

执行结果：claim/snapshot/artifact/finalize/release/fail 的数据库协议完整，但 InvoiceJob 接入这些函数的关键 end-to-end assertions 均为 skip；既有 F-0158/P1 归因得到数据库层证据。未发现 P0 或新增 P1–P3；Vitest 未运行。

## 81. AU-079 连续审计点

审阅 Finance audit record 与 hold read 的 scope/closure/keyset 边界及已有 query smoke。

执行结果：audit finance/invoice filter、hold account join、scope_allowed/closure 和 keyset 读取均已追踪；现有测试仅作 query routing smoke。未发现 P0–P3 新问题；Vitest 未运行。

## 82. AU-080 连续审计点

审阅 Finance InvoiceIssuer port、完整 FinanceModule、Identity selected module 及其入口调用链。

执行结果：签发 typed port、完整 Commerce module 与 Identity restricted read module 的实际入口均已追踪。未发现 P0–P3 新问题；Vitest 未运行。

## 83. AU-081 连续审计点

审阅 Pricing 模块入口、HTTP operations、价格与报价持久化端口、Catalog/Checkout/Runtime 调用链、数据库约束和 manifest 测试。

执行结果：主 Commerce registry、Catalog 写入、Checkout quote 保存和 cleanup job 均已追踪；公开 offers 读取、规则 create/publish 与 SDK 契约均已对照。新增 F-0159/P1 候选：已发布 pricing rule 在 Checkout QuoteReader 中仅写入 evidence，未参与任何价格/折扣计算；立即进入 AU-082 独立复核。未发现 P0；Vitest 未运行。

## 84. AU-082 连续审计点

独立复查 F-0159 的代码消费者全集、contract/openapi、Checkout 报价金额演算、已有行为测试和需求映射。

执行结果：`pricing.rule` 在 Commerce 源码的唯一读取是 QuoteReader；所有 `kind/condition/effect` 原样进入 evidence，不存在规则解释器或金额调整消费者；`PricingRulesCreateRequest` 又是无字段约束的开放对象，Pricing 测试只验证 manifest。需求映射明确将加价模板/商城规则对接这两个 operation。F-0159 确认为 P1。未发现 P0；未运行测试或改变运行状态。

## 85. AU-083 连续审计点

审阅独立部署的 WebBusiness API 中 Pricing selected module、scope resolver、公开 operation 集、composition manifest 与现有入口测试。

执行结果：WebBusinessApiMain 将 `WebPricingModule` 与唯一 `pricing.offers.read` 注册到独立 API；storefront actor 的该请求只能由 session-bound mall scope 解析。其价格查询与完整 Commerce Pricing operation 逐句重复，且同样只返回原始 pricebook price，因而不会绕过或抵消 F-0159/P1。公开入口测试锁定路由白名单与无 checkout/payment 写入口。未发现 P0 或新增 P1–P3；Vitest 未运行。

## 86. AU-084 连续审计点

审阅 WebBusiness Catalog selected read、公开无会话商品目录适配器及各自测试。

执行结果：授权 catalog read 依据 scope kind 分为 supplier/source listing、store/组织闭包 listing、storefront published-only listing，并用 keyset 分页；公开目录只接管固定 GET 路径，绑定配置/host 的 application slug，调用数据库 public projection，明确 `purchasable=false`。未发现 P0–P3 新问题；Vitest 未运行。

## 87. AU-085 连续审计点

审阅 WebBusiness selected inventory availability read、完整 Commerce 同 operation、契约与 web DB role/RLS。

执行结果：WebBusiness 对 storefront/session mall 与 console hierarchy scope 返回 closure 内库存，SQL/RLS 都只读；完整 Commerce 实现却要求 `access.mall_id` 并只查单一 mall。新增 F-0160/P2：同一 operation/path 在两个实际 API 运行单元具有不等价范围语义，且无等价性行为测试。未发现 P0；Vitest 未运行。

## 88. AU-086 连续审计点

审阅 WebBusiness Reporting dashboard operation、shared query lifecycle、缓存回退和行为测试。

执行结果：selected Web operation 重用 period-aware reporting repository；cache hit 不建事务，cache key 含 scope/metric/period/projection version，缺共享 CACHE binding 时仅回退进程内 512 项 TTL cache。测试覆盖 hit/miss、cursor 时间和本地回退。未发现 P0–P3 新问题；Vitest 未运行。

## 89. AU-087 连续审计点

审阅 WebBusiness Member selected operations、session-bound member context、KMS 地址 envelope、Hosted mall open 与 sovereign upgrade reuse。

执行结果：profile/address 每次通过 `access.web_member_context(membership,session)` 重证 active session、principal、version 与 member；地址敏感字段在 save 前以 actor principal 加密。mall open/upgrade 复用 node-context-bound MemberPort action，已有 port tests锁定 active node/membership SQL。未发现 P0–P3 新问题；Vitest 未运行。

## 90. AU-088 连续审计点

审阅 WebBusiness Order 聚合 read、角色/组织范围过滤、payment/finance/fulfillment projection 与数据库 grant/RLS。

执行结果：owner/supplier/store/组织 closure 的 order 主表范围、过滤枚举和 keyset 均已追踪。新增 F-0161/P2：Web role 后续获得 payment/finance 表 select，但相应 RLS policy 不存在；这些 lateral projection 对该 role 默认拒绝，故订单返回中的 payment/finance facts 很可能恒为空，而现有测试只断言 SQL 文本。未发现 P0；Vitest 未运行。

## 91. AU-089 连续审计点

审阅 WebBusiness Benefit account/ledger read、session-bound SECURITY DEFINER projection、web role grant 与完整 Benefit 对照。

执行结果：Web account/ledger 均将 membership+session 交给只授予 web role 的受控函数；函数再次校验 live session/principal/member/scope，才跨 Finance 读取余额或 posted ledger。查询只访问必要 benefit tables并 keyset。未发现 P0–P3 新问题；Vitest 未运行。

## 92. AU-090 连续审计点

审阅 WebBusiness RiskGate、transaction/database context、policy hierarchy、signals/list、velocity 与行为测试。

执行结果：风险计算使用只读事务并设置 actor/scope context；从 access hierarchy 叠加 scope policy，读 signal/block list/decision audit 后取最严 outcome。web role 的 risk RLS 与函数授权闭合，适配器不写 risk event/outbox。测试覆盖 deny、数据库失败传播（调用方 fail-closed）和当前请求计入 velocity。未发现 P0–P3 新问题；Vitest 未运行。

## 93. AU-091 连续审计点

审阅 Organization 层级 operation、公开/兼容 export、manifest/test 与 WebBusiness selected registration。

执行结果：唯一 operation 由 unitclosure descendant read 实现，范围来自已授权 access.scope，ID keyset 最大 1,000；全量 Commerce 与 WebBusiness 都复用同一 implementation，未形成双实现。manifest、capability、入口与静态测试声明闭合。未发现 P0–P3 新问题；Vitest 未运行。

## 94. AU-092 连续审计点

审阅 WebBusiness 公开目录的 security-definer 数据库投影、运行角色授权、HTTP 绑定与分页参数边界。

执行结果：函数仅授予 zhudatuanwebapi，固定 search path；active application/release、binding、published listing、有效价和层级库存均在函数内限制。HTTP wrapper 将 host 映射与默认 application 绑定，阻断跨 mall 查询。发现 F-0162/P2：HTTP 接受大于 PostgreSQL integer 上限但仍是 JavaScript safe integer 的 cursor，随后传给 integer 函数参数而导致数据库异常/5xx；测试未覆盖该边界。未发现 P0/P1 新问题；Vitest 未运行。

## 95. AU-093 连续审计点

审阅 Organization 创建 port、兼容公开导出及其在 CreateMall 事务式编排、Identity/Channel 消费者中的边界。

执行结果：商城创建先以事务 advisory lock 和 parent/代码存在性检查确定冲突，再写 organization、closure 与 sourcebinding；后续同一 operation 继续创建 pool、application、binding 与 owner。稳定 ID 使相同 parent/code/slug 的重复计划收敛。OrganizationPort 的 kind/createDistributor/rename/disable 均有明确 Identity 或 Channel 调用者。未发现 P0–P3 新问题；Vitest 未运行。

## 96. AU-094 连续审计点

审阅 Identity capabilities、跨模块 notification/principal/retention/Wechat ports 及其 notification job、runtime retention、member import 运行消费者与状态测试。

执行结果：通知投递仅在未消费/未过期 challenge 上读取密文；beginAttempt 将遗留 sending 固化为 ambiguous，状态终结操作仅允许从 sending 迁移，并将失败/未知投递写为 identity owner deadletter。保留任务只调用受控 purge 函数；member import 仅依赖窄 principal 接口。Wechat 为容器 token 契约，已有 runtime/registration 注入者。未发现 P0–P3 新问题；Vitest 未运行。

## 97. AU-095 连续审计点

审阅 Identity 授权 state/nonce/PKCE 交易、手机号/身份主体归一化、scrypt 密码策略与关联单元测试。

执行结果：AuthTransaction 对 state/nonce/ticket/PKCE token 作格式和长度约束，持久层后续以所有 hash/challenge 一并消费 ticket。手机号归一为 E.164，中国本地号与 +86 形式合并，保留非手机号 username 的小写规范形式。密码使用固定参数 scrypt、随机 salt 和恒定工作量的空用户验证；policy 复用共享契约。未发现 P0–P3 新问题；Vitest 未运行。

## 98. AU-096 连续审计点

审阅 Identity realm/node/target/account 解析及 SMS、password 登录的账号定位、challenge 验证与消费边界。

执行结果：realm 由 active entry host/target registry 解析，host 与 application 必须精确匹配；active membership 先使用数据库 resolver，保留受检测控制的旧投影兼容路径。手机号/password 查询均以 realm containment、active account 和目标 client/organization membership 收敛，并对多 principal 歧义拒绝。SMS challenge 以 purpose、destination、realm、expiry、未消费状态及行锁验证，再条件消费。未发现 P0–P3 新问题；Vitest 未运行。

## 99. AU-097 连续审计点

审阅 Identity WeChat binding、savepoint/transaction/idempotency/outbox、AuthTicket issue/consume 与 member import principal 适配器。

执行结果：WeChat binding 先锁定未消费未过期 grant 与 identity，检查同 app/account 冲突，再以 active membership 条件更新并消费 grant。业务子写入在 savepoint 内回滚，外层 transaction 负责 context/commit/rollback；事件写入 outbox。AuthTicket 同时绑定 state/nonce/PKCE/session/account/realm containment，且在行锁下单次消费。principal import 只调用受控数据库函数。未发现 P0–P3 新问题；Vitest 未运行。

## 100. AU-098 连续审计点

审阅 Identity WeChat OAuth/code exchange、JSSDK token/ticket cache、callback URL 配置与认证返回地址签名边界。

执行结果：ReturnTargetSigner 仅签发无 credential/hash/query 的 HTTPS URL，签名有效期为一分钟。WeChat gateway 只接受精确的两场景应用配置，OAuth state/code/provider 响应有格式约束；callback 要求公开 HTTPS 固定路径，拒绝本地/私网/查询。JSSDK 签名移除 fragment，token/ticket 按官方账户缓存并合并并发请求。未发现 P0–P3 新问题；Vitest 未运行。

## 101. AU-099 连续审计点

审阅 Identity 全量/注册 selected module 装配、WeChat runtime 开关分支、公开导出、manifest 及声明测试。

执行结果：完整 Commerce 始终注册 IdentityModule；注册 API 依据已解析 runtime 的 WeChat enablement 在带 WeChat wrapper 的 selected module 和 core-only selected module 之间选择，二者 operation 集合明确分离。FullIdentityOperations 从容器取得 KMS、audit、secret keys、WeChat gateway 与 command pool 后统一创建票据/wrapper。公开入口、capability、manifest operation/event/entrypoint 与测试声明一致。未发现 P0–P3 新问题；Vitest 未运行。

## 102. AU-100 连续审计点

审阅 Identity cookie/target/challenge 辅助函数、session 创建/票据交换/会话管理及跨节点 login intent。

执行结果：session cookie 使用 Secure、HttpOnly 与 SameSite；session 创建把 provider、realm target、membership、challenge/credential、assurance、ticket 和跨节点 login intent 闭合在 operation transaction 中。ticket exchange 只接受当前 session cookie；会话读取/撤销以当前 active realm account 限定。跨节点 intent 必须由已认证 source node 生成，并让数据库返回 target account host。新增 F-0163/P3：已过期但未消费 challenge 的错误 code 请求仍会在失败记数 SQL 中增加 attempts，和首轮消费 SQL 的 expiry 条件不一致。未发现 P0–P2 新问题；Vitest 未运行。

## 103. AU-101 连续审计点

审阅 Identity 成员重置、password change/verify/reset 的权限、锁、事务、凭据/会话撤销和 outbox 路径。

执行结果：成员重置只允许精确 owner，要求 expected version、作用域内成员、近期 password reauthentication，并保护当前 owner/owner membership；随后锁定 subject、撤销 tickets/sessions/assurances/credential/access、保留历史匿名化记录并发布 reset event。password change/verify/reset 均定位 active realm account；change/reset 同步增 credential version 与撤销会话，owner 密码走受控数据库 rotation。未发现 P0–P3 新问题；Vitest 未运行。

## 104. AU-102 连续审计点

审阅 Identity invitation read/create/revoke、storefront registration 信息与后台成员 create/update/status 管理链路。

执行结果：operator invitation 绑定租户、唯一 mall storefront、手机号、single use role、有效 policy/terms，并要求 console capability 与 owner/senior-administrator governance；revoke 使用 scope/target/runtime/version 条件。成员 status/update 重新解 authoritative governance、撤销 session，离职同步失效角色/grant/邀请。新增 F-0164/P2：后台成员 create 对 username 仅 trim 后直接 hash，未应用登录侧 lowercase canonicalization，含大写 username 会被创建但无法由正常 password 登录定位。未发现 P0/P1 新问题；Vitest 未运行。

## 105. AU-103 连续审计点

审阅 Identity registration challenge 与 member create：邀请码/公开 storefront 路径、challenge 绑定、realm/account 选择、hosted member node、membership、session/ticket、WeChat 绑定和事务回滚。

执行结果：challenge 将 registration purpose、规范化手机号、realm 与 invite/storefront hash 同时绑定；注册先经 realm 内 subject advisory lock，再按 invite 或已发布 storefront 确定组织、条款和目标。新身份创建 hosted node、identity/account/credential/profile/membership；既有统一手机号只新建独立 membership。final WeChat bind、outbox、session/ticket/login intent 位于同一 identity mutation 边界，失败会回滚先前业务写入。checkout 延迟电话校验是已显式实现且有行为测试锁定的产品路径，session assurance 为 1。未发现 P0–P3 新问题；Vitest 未运行。

## 106. AU-104 连续审计点

审阅 Identity full/registration operation 集合、动作组合、public HTTP catalog 声明和综合行为测试。

执行结果：full runtime 将五组 actions 组合后按 immutable owned operation list 精确投影；registration runtime 只取注册 API 必需的 core 集合，WeChat operation 留由带 WeChat wrapper 的注册模块加入。若声明 operation 没有 action 会在装配期立即失败。目录测试锁定 23 个 core operation 的 HTTP method/path、无重复 partition 与 registration ownership。综合测试对 session realm/account、成员治理、financial action proof、invitation 和 notification queue 提供 query-level oracle。未发现 P0–P3 新问题；Vitest 未运行。

## 107. AU-105 连续审计点

审阅 Identity 手机变更、phone-change challenge、step-up、WeChat bind completion 和金融操作 action proof。

执行结果：mobile change 绑定 current realm account、session、phone proof 与目标 mobile advisory lock；首次绑定要求近十分钟 password evidence，替换要求 level-3 step-up，并在完成后轮换 credential subject、失效旧 phone assurance 与所有关联 session。step-up 只向 profile 已验证手机号发送，challenge 绑定 session；完成后先更新 session assurance，再完成可选 WeChat bind 或按 canonical action request 签发短期金融 proof。已审阅的 AU-103/104 测试覆盖关键成功/失败与回滚路径。未发现 P0–P3 新问题；Vitest 未运行。

## 108. AU-106 连续审计点

审阅 Identity operation runtime context、hash/secret、ticket signer、registration reference 和 storefront/invitation validation helper。

执行结果：runtime context 从 DI 获取唯一 pool/audit/KMS/key 集合，按 identity/session 密钥职责产生 HMAC/Hash；auth ticket 通过短期 return-target signer 构造。registration 要求 invite 与 storefront application 二选一，storefront slug 有精确格式上限；无效 invite/storefront 统一翻译为稳定业务错误。notification scope 只对有 parent 的 node 取 manifest node id。未发现 P0–P3 新问题；Vitest 未运行。

## 109. AU-107 连续审计点

审阅 WeChat wrapper 的 JSSDK/authorize/exchange、federated identity、registration/account-confirmation grant、WeChat session/ticket 和已登录 bind。

执行结果：公开 JSSDK 和 authorize 只允许 jsapi 场景；exchange 按 entry realm/目标 storefront 解析，identity subject 加密并将 provider/application/realm 组成唯一性边界。已绑定 identity 只在 membership/account/realm/target 仍匹配时创建 session；已登录但不同 account 只发十分钟 confirmation grant。revoked identity 和会话绑定失败由同一 transaction 回滚。已登录 bind 采用 actor 的 current realm account。未发现 P0–P3 新问题；Vitest 未运行。

## 110. AU-108 连续审计点

审阅 Audit 公开 repository contract、审计记录读取 cursor query 和 Commerce module HTTP 装配；append、archive、脱敏链此前已在 AU-051 审阅，不重复计入。

执行结果：AuditPort 明确 previous/append/read/archive/schedule 的唯一跨模块契约。audit.records.read 强制 access scope，以 page fetch plus one 实现 keyset next cursor；HTTP module 只组合该 query operation，并从容器取得 repository/pool/audit sink。未发现 P0–P3 新问题；Vitest 未运行。

## 111. AU-109 连续审计点

审阅 Benefit plan/budget/grant API、payment benefit reserve/consume/refund、grant/revoke/expiry Worker、deadletter、manifest 与全部模块文件。

执行结果：plan/budget 以状态、乐观版本和 scope 条件更新；grant create/decide 分离 requester/approver 并 reserve budget。Worker 在 transaction 内按 item lock 创建 lot/finance journal/outbox，未激活 grant 可取消/释放，已 grant lot 按剩余额撤销；expiry 激活、提醒、过期与 budget 余额同步。checkout reserve/consume/refund 以 account/lot/reservation 锁和 finance posting 闭合。新增 F-0165/P2：现有测试仅覆盖 policy 与 manifest，未验证任何 API、grant/revoke/expiry worker 或资金状态转换。未发现 P0/P1 新问题；Vitest 未运行。

## 112. AU-110 连续审计点

审阅 Capability entitlement 公开端口、HTTP read/manage、module/manifest 与测试。

执行结果：assignment read 绑定当前 access scope，并以 capability name/id keyset 分页；manage 只更新同 scope entitlement，采用 expected version 保护。公开 CapabilityPort 为 ChannelRoutes 配额写入的唯一直接消费者，持有同一 scope/version 条件 SQL。module manifest/公开导出与两项 HTTP operation 一致。未发现 P0–P3 新问题；Vitest 未运行。

## 113. AU-111 连续审计点

审阅 Channel HTTP 管理入口中的 distributor、tenant binding、Capability quota、provider operation replay 以及 manifest 目录。

执行结果：distributor create/update/disable 以 organization closure 可见性绑定数据所有权；tenant binding 证明 distributor 与 tenant 同处 access scope 后写入。quota manage 委托 CapabilityPort 的 scope/version 条件 SQL。operation replay 仅接受 failed/unknown，按 refund/fulfillment 类型重投对应 queue job。无行为测试，只有 manifest 静态目录；未发现 P0–P3 新问题；Vitest 未运行。

## 114. AU-112 连续审计点

审阅 Channel connection 的 create/update/test/enable/disable、sync start/cancel、队列投递与四类同步 Worker 的完整运行链。

执行结果：create 先校验 secret/manifest/extension，再同一 command transaction 插入 connection；test/enable/disable 以行锁、状态机和版本条件转移，enable finalize 在 commit 后 activate extension。sync start 仅接受 enabled connection，并按 kind 投递独立 job；Worker 注册到 catalog/price/inventory/statement 四类 runner，写入各自投影、outbox 和续页 job。新增 F-0166/P2：cancel 可在 Worker 执行后发生，但 finish/completeEmpty 无 cancelled 条件地回写 running/completed，取消状态会被覆盖且可能继续产生同步副作用。新增 F-0167/P2：该状态机和 Worker 没有行为测试，现有测试只验证 manifest 静态清单。未发现 P0/P1 新问题；Vitest 未运行。

## 115. AU-113 连续审计点

审阅 Channel provider Webhook 的 HTTP 入口、provider resolver/验签、KMS 原文保存、数据库 accept function、runtime job 和异步状态投影。

执行结果：入口先从 enabled/degraded connection 取 provider/scope，再经 extension Webhook port 验签和规范化；同一 transaction 以 channel.accept_webhook 原子写 inbox 与唯一 job，并写审计记录。Worker 行锁 claim，按 external reference 更新 provider operation，必要时投递 tracking job，写 channel/refund outbox 后标记 applied/ignored。复核既有 F-0094/P1 候选：通用 verifier 的签名材料未绑定用于 inbox 唯一键的 event ID；本审计未看到线上启用/下游实际影响，因此不升级且无新增 P0/P1。模块仍无行为测试，F-0167/P2 扩展覆盖该 ingress/Worker；Vitest 未运行。

## 116. AU-114 连续审计点

审阅 Channel connection 与 sync run 的两个 API read implementation，以及 sovereign identity runtime 的 selected-module 装配。

执行结果：两条 read 都按 access scope 查询，connection 用 id keyset 并只输出 has_secret，sync run 通过 connection scope join 和 started_at/id keyset 隔离；identity runtime 只注册这三项 Channel operator read operation。新增 F-0168/P3：同一 connection/sync run 查询在 ChannelRoutes 和 ChannelReadOperations 各维护一份等价 SQL/投影，当前输出相同但未来变更可造成两个已部署 API runtime 漂移。未发现 P0–P2 新问题；Vitest 未运行。

## 117. AU-115 连续审计点

审阅 Channel provider-operation 公共端口，以及 fulfillment order、WeChat refund 对该端口的 record/update/replay 调用。

执行结果：fulfillment 在 provider submit 后同一 transaction 写 operation、状态和 tracking job；payment refund 在 provider attempt 前写 processing，随后按权威观察更新 terminal/unknown 状态。operation 表以 provider/kind/idempotency 唯一键和 request hash 防止同 key 不同请求覆盖。新增 F-0169/P2：`record` 的冲突 SQL 以 request hash 不匹配拒绝 update，但方法不检查结果；调用者会继续，把不匹配的请求静默视为已记录，无法显示并处理幂等冲突。未发现 P0/P1 新问题；Vitest 未运行。

## 118. AU-116 连续审计点

审阅 extensionhealth scan/probe、version-bound health evidence、Extension 安装状态与 Channel connection 降级回写。

执行结果：scan 只投递 testing/enabled/degraded installation；probe 先 stage provider、记录指标，再在 transaction 内以 installation version 锁定 health record。enabled 的不健康 probe 会同时 transition extension 与 connection 为 degraded，并保留 registry instance；恢复明确要求 operator test/enable 原子替换，符合 runbook，不是自动恢复遗漏。新增 F-0170/P2：health job、stage/transition/degrade/scan/recovery 分支没有行为测试，现有 Extension/Channel 测试只有 manifest 声明。未发现 P0/P1 新问题；Vitest 未运行。

## 119. AU-117 连续审计点

审阅 Channel 对 Catalog、Price、Stock、Statement 的四项公共源类型契约与实际消费者。

执行结果：四文件均仅从 `@shop/contract` 再导出 type；ChannelModule/index 将其作为稳定公共 API 传出。ChannelSyncJob 的实际运行写入直接使用 catalog/pricing/inventory/finance 的公开端口，并不通过这些 type alias。未检到仓内直接 import consumer，但公共导出可能是外部 SDK/扩展的编译契约，归类 G0，不作为删除候选。未发现 P0–P3 新问题；无适用行为测试。

## 120. AU-118 连续审计点

审阅 Channel RemoteOrderSubmitter/RemoteRefundProvider 的 public/application type re-export，与 provider core 实现/履约支付消费者。

执行结果：四个 Channel 文件均只把 `@shop/contract` 接口传递给 module public API 或旧 application 路径；真正的 provider port 在 `@shop/contract`，实现由 provider core PortFactory 创建，履约与支付运行时直接以 extension registry 获取 port。仓内没有直接 import 这四个 alias；外部编译消费者未知，归类 G0，不作为删除候选。未发现 P0–P3 新问题；无适用行为测试。

## 121. AU-119 连续审计点

审阅 Channel ExternalMapping 领域模型及其 price/stock 同步调用。

执行结果：模型验证 provider/object/external/internal/version 六项非空，并提供 provider/object/external 组合 identity；ChannelSyncJob 在价格和库存 record 映射前实例化它，作为输入边界校验。实际 SKU 解析仍由 CatalogSourcePort 持久化映射负责，模型不重复写库。identity 当前无直接消费者，但构造器有真实运行验证职责，归类 G0。未发现 P0–P3 新问题；无独立模型测试。

## 122. AU-120 连续审计点

审阅 Channel root compatibility re-export、模块 public index、完整 ChannelModule 与 IdentityRegistration selected module 装配。

执行结果：root 路径全为无逻辑转发；module index 划分 public capability/operation/types/manifest 与 interface exports。完整 ChannelModule 依赖 extension/catalog/inventory/fulfillment/finance，注册全量 channelRoutes；IdentityOperatorChannelModule 只选择三项 read operation 并依赖 identity。IdentityRegistration API entrypoint 测试证明其静态闭包不进入完整 ChannelModule/ChannelRoutes。兼容入口有公开/构建边界责任，归类 G0；未发现 P0–P3 新问题。

## 123. AU-121 连续审计点

审阅 Channel 旧英文目录下 command/port/query/domain/infrastructure/interface 的兼容入口，以及 capability 常量。

执行结果：23 个旧路径文件均为无逻辑 `export *`，稳定导向已深审的中文分层实现；这些路径仍可能服务旧 import、测试和外部构建，全部归类 G0。ChannelCapabilities 只定义 read/manage 两个 module public capability 常量，与 manifest/public index 一致。Channel 模块 64 文件现已全部有覆盖状态。未发现 P0–P3 新问题；无适用行为测试。

## 124. AU-122 连续审计点

审阅 Extension manifest/identity/contract policy、install/reconfigure、test/enable/disable 与 repository transition/history。

执行结果：install 验证已登记 manifest、payload/hash/signature、host contract、secret/config 与 installation history；reconfigure 只在 disabled 状态下版本更新。test 将 disabled/degraded 转 testing 并异步 health；enable 只接受 healthy、相同版本的 testing/degraded candidate，在同一 transaction 原子替换旧 active installation，commit 后才 loader activate；disable commit 后才卸载 loader。新增 F-0171/P2：只有 ContractPolicy 与 manifest 静态测试，缺少 install/reconfigure/test/enable/disable、version stale、transaction rollback 和 loader finalize/discard 行为测试。未发现 P0/P1 新问题；Vitest 未运行。

## 125. AU-123 连续审计点

审阅 Extension installations read query、HTTP/module 装配、public index/manifest 与兼容入口。

执行结果：read 统一通过 repository list，以 access.scope_allowed RLS 限定可见 installation；HTTP ModuleOperations 只拥有该 read operation。manifest、public export 和 test 的 HTTP/job/event inventory 一致；旧 application/interface/module 入口只是兼容转发。未发现 P0–P3 新问题；Vitest 未运行。

## 126. AU-124 连续审计点

审阅 Extension 跨模块 loader/repository/state-sink 公共契约、PostgreSQL repository factory，以及 Installation/Manifest 领域模型测试。

执行结果：`ExtensionLoader` 集中定义 candidate、生命周期、repository、health/state-sink 和 read/write 投影契约；factory 无额外行为，只构造既审的 `PgExtensionRepository`。Installation 测试覆盖 disabled/testing/enabled 的允许与拒绝迁移；Manifest 测试覆盖签名 canonical hash、重复 capability 和并发上限。未发现 P0–P3 新问题；Vitest 未运行。

## 127. AU-125 连续审计点

审阅 Extension 旧英文 application/domain/infrastructure/interface 兼容入口，逐文件核对其导出目标与已经深审的运行实现。

执行结果：11 个入口均为单行 `export *` 转发，分别导向已审的 install/enable/disable、loader、domain model/policy、repository 和 health job。它们没有独立运行逻辑，但仍维持旧 import 与可能外部构建兼容，归类 G0，不作为删除候选。Extension 35/35 文件现均有明确覆盖状态；未发现 P0–P3 新问题；无适用行为测试。

## 128. AU-126 连续审计点

审阅 Notification 的完整/selected HTTP module 装配、operator read operations、module manifest、identitynotification 专用 worker runtime，以及对应的 job/backlog/manifest 测试。

执行结果：完整 NotificationModule 将身份、订单、支持依赖和八项 operation 组装到 HTTP；identity runtime 仅装配 announcements/templates 两项 read。主 jobs catalog 注册 generic notification processor；identity 独立运行单元以 identity job DB identity、manifest/secret binding/contract 检查和专用 QueueJob 处理 challenge。backlog monitor 对 queued、failed、stale lease 和未处理 delivery alert 写 telemetry/deadletter。三项测试覆盖 identity payload 白名单、backlog 告警/恢复、manifest 声明。未发现 P0–P3 新问题；Vitest 未运行。

## 129. AU-127 连续审计点

审阅 Notification 投递公共契约、registry、SMS/email/WeChat/in-app adapter、完整/identity 专用配置解析及其局部行为测试。

执行结果：CommerceRuntime 仅在配置存在时注册四渠道；identity runtime 只注册 SMS。registry 拒绝重复 id 和未配置渠道。SMS 使用 short external timeout、单次 SDK attempt 与 Executor 重试；email 写 idempotency header，WeChat 缓存 access token 并以 subscription API 投递，in-app 以 dispatch id 回执。identity 配置严格限定 SMS role 或 access-key 二择一和阿里云 endpoint/region/template 格式；测试覆盖 email 无凭据泄漏、WeChat token 缓存及 identity 配置拒绝路径。未发现 P0–P3 新问题；Vitest 未运行。

## 130. AU-128 连续审计点

审阅 Notification capability/repository 公共契约、偏好/endpoint、模板、公告管理命令及三条读取 query。

执行结果：全部 operation 从 access scope/membership 派生数据所有权；endpoint 写入使用 operation lifecycle，在 execute 阶段重新解析 member，WeChat endpoint 强制 identity subscription authorization；template 写入由 repository 返回 immutable/state transition 结果判定；announcement 使用 expected version；读取全部 keyset，并按 storefront actor 限制通知可见 scope。新增 F-0172/P2：八项 Notification HTTP operation 仅有 manifest/路由声明测试，未覆盖 scope/version、endpoint 加密/撤销、WeChat 授权和写入拒绝行为。未发现 P0/P1 新问题；Vitest 未运行。

## 131. AU-129 连续审计点

审阅 Notification root/application/domain/infrastructure/interface 旧英文兼容入口及 public `index.ts`，逐文件核对导出目标。

执行结果：27 个旧路径均为一行 `export *`，只导向已深审的中文分层实现；public index 仅导出 capability、public type、domain type 和 manifest，不导出 adapter/command。旧路径仍可能服务外部或遗留 import，归类 G0。Notification 63/63 文件已获得明确覆盖状态；未发现 P0–P3 新问题；无适用行为测试。

## 132. AU-130 连续审计点

审阅 Catalog 完整/selected module、公共 capability/source/provisioning port、manifest 与 catalogimport Worker 的实际注册链。

执行结果：完整 CatalogModule 依赖 partner，selected CatalogOperatorModule 不带跨模块依赖；manifest 声明 13 项 HTTP operation 和 catalogimport job。source port 以 provider/scope/external 唯一键更新 source listing，provisioning port 为新 mall 原子建立 private pool 与 selected binding。catalogimport Worker 根据 uploaded/validating/ready/running/reporting 状态推进，包格式错误 reject，其他错误 fault 后交给 QueueJob 重试；主 jobs catalog 已注册 import queue、4 并发、120 秒 timeout、180 秒 lease。未发现 P0–P3 新问题；Vitest 未运行。

## 133. AU-131 连续审计点

审阅 Catalog 商品池/产品/listings HTTP actions、listing management classification、发布批次与状态读取，以及 selected operator operations。

执行结果：operator 与 storefront 的 listing 查询分支均从 access scope 出发；storefront 只取有效 published listing，operator 获得 management classification/summary。publish/unpublish 需 expected version，published 时从 active storefront application 选取 pool；批量 ready/retry 将 durable progress/failures 写入 catalogpublication job，读取时验证 counter 一致性且 scope 过滤。selected operator 只暴露 import 与 listing publish/batch 操作。未发现 P0–P3 新问题；Vitest 未运行。

## 134. AU-132 连续审计点

审阅 Catalog 上传/确认操作、package object/JSON 行规范化、逐行 product import、Cake provider source projection 与 PostgreSQL import state persistence。

执行结果：上传以 scope+SHA advisory lock 去重，object metadata/hash/scan 三者一致才复用；confirm 对 import row 行锁并只从 ready 转 running。package 限制 32MiB/100k 行、UTF-8 JSON/schema/source/validation；stage 每 500 行落库并校验，process 在 worker transaction 中逐行 savepoint，错误写 importerror、续页投递新 job、reporting 后才完成报告。Cake projection 将 product/SKU/listing/price/stock/source mapping/media replication job 同链写入；未发现 P0–P3 新问题；Vitest 未运行。

## 135. AU-133 连续审计点

审阅 Catalog 媒体 replication、product media binding、媒体 target/resolver/OSS adapter、媒体持久化和 catalogmediareplication Worker。

执行结果：replication 向所有 enabled target 上传后以 size/SHA head 验证，任一 required replica 不完整即解绑 product media；OSS adapter 将 SHA 写 object metadata，持久化写 mediaobject/replica/binding。Worker 从 sourceUrls 逐个 raw fetch、将完整 response 读入内存后才注册并更新 coverUrl。新增 F-0173/P1：sourceUrls 只检查非空字符串，未限制 URL scheme/host/private address/redirect/response size，Cake provider source 可使 worker 访问任意网络地址或消耗未界定内存；已进入独立复核队列。未发现 P0；Vitest 未运行。

## 136. AU-134 独立复核点

独立重新审阅 provider source 进入 ChannelSyncJob、CatalogSourceProjection、runtime.job、CatalogJobsRuntime 和 CatalogMediaReplicationJob 的全链，并重读针对该链的两项媒体测试。

执行结果：ChannelSyncJob 将 extension `pullCatalog` 返回的 payload 不加 URL policy 交给 CatalogSourceProjection；projection 将 Cake `imagePaths` 直接写 job；production-enabled CatalogJobsRuntime 默认构造 processor 的原生 fetch。两项测试仅使用 HTTPS 示例/不可用 fallback，不覆盖 private IP、http、redirect 或响应大小。复核与 AU-133 一致，F-0173 保持 P1、高置信度，已双轮确认；未发现 P0；Vitest 未运行。

## 137. AU-135 连续审计点

审阅 Catalog publication Worker 逐 listing 发布、durable progress checkpoint、冲突回滚及行为测试。

执行结果：Worker 冻结或旧式查得 target list 后，以 `for update`、listing readiness/pool 条件和 upsert poolitem 逐项发布；每项在独立 transaction 内先推进 guard-protected runtime job progress，冲突则回滚 listing。checkpoint 仅允许 counters 单调增加且 failures 与 failed 数一致。三项测试覆盖 published/skipped/failed、断点恢复及 progress conflict rollback。未发现 P0–P3 新问题；Vitest 未运行。

## 138. AU-136 连续审计点

审阅 Catalog OSS adapter、media replication coordinator 和 product media PGlite persistence 的三项完整测试。

执行结果：OSS 测试验证 put/head、缺失对象归一化、认证/网络错误不吞没、每 target 独立 credential；replication 测试验证 content-address key、required/optional target、hash mismatch、重试和 public URL；PGlite 测试验证 replica 证据、binding/unbinding、失败恢复、多 target、stable position、导入 fixture 和 migration ledger。未发现 P0–P3 新问题；F-0173 的 hostile source URL/redirect/size 反事实仍未覆盖；Vitest 未运行。

## 139. AU-137 连续审计点

审阅 Catalog mall command、standard package 和 PgCatalogImport 三项行为测试。

执行结果：CatalogOperations 测试覆盖 mall+SHA 去重、confirm、scope listing read/publish、supply network、publication task/retry/status/progress；CatalogPackage 测试覆盖 fixture parse、精确 mall fact 写入与稳定 row error；PgCatalogImport 测试覆盖 stage 不写事实、running 后写四类事实、无效行隔离。未发现 P0–P3 新问题；Vitest 未运行。

## 140. AU-138 连续审计点

审阅 Catalog 风险拒绝 command、SKU public port/Pg 查询，以及 reverse-lookup、supplier-network 和 manifest 三项测试。

执行结果：Risk Worker 将 `riskscan` 的 deny decision 置于 transaction 内调用 Catalog action；该 action 只撤销仍 published 的 scope-bound listing，并以 risk decision id 写幂等 outbox。SKU 仅在 product owner 或 source-listing 证明 scope 时按 id/code 解析，主 jobs catalog 只将其注入 InventoryImportProcessor。两项 PGlite fixture 测试分别覆盖 catalog reverse lookup 索引和供应网络数据事实，manifest 覆盖声明 inventory。未发现 P0–P3 新问题；按既有 npm test 入口定向执行因 audit worktree 缺少 `vitest` 退出 127，运行结论未验证。

## 141. AU-139 连续审计点

审阅 Catalog 剩余的两项测试 fixture 与八个 root/legacy compatibility entrypoint，并反查其 import/fixture consumer。

执行结果：两项 JSON 均为明确标注 mock/simulated 的测试 package，只由已审媒体注册、package parser 和 Pg import 测试读取。其余八项全为单向 re-export；legacy `interface/job/CatalogImportJob.ts` 仍被主 jobs catalog 实际导入，其他 public/root export 维持旧 import 与公共 contract 稳定性，归类 G0。Catalog 目录 70/70 基线文件现均有文件级审阅状态；未发现 P0–P3 新问题；无适用新增行为测试。

## 142. AU-140 连续审计点

审阅 Purchase session/composition、quote/order/payment adapter、policy、manifest、public entry 及其 local behavior tests，并从独立 Purchase API runtime 与 access purchase function 反查入口。

执行结果：Purchase API 只接受 storefront session，将 quote/order/payment 注册为三个 selected module；cart/order/payment 上下文与 recovery job 都由 session-bound `access.purchase_*` function 提供。benefit 需 membership/session/intent，voucher 与未配置 external payment 均明确拒绝；internal payment 以 locked payable intent、risk decision 和 tender arithmetic 进入 settlement。新增 F-0174/P2：没有行为 fixture 直接调用 quote create/order create composition，现有 route test 只验证注册；未发现 P0/P1，未重复执行已知缺失 Vitest 的命令。

## 143. AU-141 连续审计点

审阅 Runtime 共享 dependency health、Purchase/Web Business/Identity Registration/Mall Provisioning 专用 profile health、module/public entry/manifest 及局部测试，并反查 bootstrap/entry 装配。

执行结果：shared API probe 对 queue/deadletter/cache/query metrics/compatibility 做并行读取并带 audit transaction；四个专用 profile 均只暴露 live/ready/startup，compatibility 异常归一为 503。selected modules 和 manifest 将 profile 装入对应独立 API。新增 F-0175/P2：现有测试仅覆盖共享 SQL 聚合语法及 manifest identity，未对四个专用 profile 的 ready/blocked/live/unknown-operation 行为建立 fixture；未发现 P0/P1，Vitest 未运行。

## 144. AU-142 连续审计点

审阅 Voucher 公开 contract、状态策略、19 项 HTTP operation/查询、full/identity module 装配、manifest 与现有 policy/manifest tests。

执行结果：全模块以 member/finance 依赖装配写入和查询，identity selected module 仅暴露五项 read；写路径的 scope、row lock、version、allocation、审批分离、状态批次和 worker job 投递均可在实现定位，读取使用 scope predicate/keyset。新增 F-0176/P2：本模块没有 operation action/repository/transaction fixture，现有测试仅覆盖 policy 和 manifest；未发现 P0/P1，Vitest 未运行。

## 145. AU-143 连续审计点

审阅 Voucher public adapter、encrypted card import persistence/import worker、issue/expiry/status processor、deadletter 和主 jobs catalog 运行链。

执行结果：VoucherPort 对 reserve/consume/refund/store verification 做锁定、状态事件、redemption/reversal 与财务事实；import 以 500 行加密分片、worker context、逐行 savepoint、continuation/report 收口；issue/status/expiry 以 lock/skip locked、chunk、policy、outbox/finance 运行，deadletter 使失败任务显式落终态并释放已占 allocation。新增 F-0177/P2：没有此 adapter/persistence/Worker/deadletter 的直接行为测试；未发现 P0/P1，Vitest 未运行。
