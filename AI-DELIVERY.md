# 全项目统一 AI 发布入口

本文件是本仓库所有人和所有 AI 的发布权威入口。业务开发工具可以不同，生产发布不得各自拼装命令。

## 唯一入口

```bash
npm run release -- plan --from <base> --to <commit> [--node <node>] [--target <target>]
npm run release -- install --mode <agent|verify> --source-sha <commit> --approve-install zdt-next:install:<commit>
npm run release -- install --mode runtime-candidate --node <node> --source-sha <commit> --approve-install zdt-next:install:<commit>
npm run release -- build --plan <plan.json>
npm run release -- package --build <build.json>
npm run release -- deploy --package <package.json> --node <node> [--target <target>] --environment candidate
npm run release -- verify --node <node> --target <target>
npm run release -- status [--node <node> --target <target>]
npm run release -- rollback --node <node> --target <target>
```

任何 AI 在发布前必须先运行 `plan`，并以计划输出的变更影响、真实目标、必需验证、逐目标制品、部署顺序、指针和重启范围为准。发布单一运行目标时必须显式传入 `--target`；计划只保留该目标消费的文件差异、验证和制品。无法精确分类的改动在未指定目标时选择所有可达运行目标作为上界，指定目标时只选择该目标作为上界。

> **校验前移（2026-09-11）：** 所有测试 / typecheck / build / package 在 PR 的 `Affected Delivery` CI 里跑完，合并到 `zdt-next` 时自动把候选制品暂存到阿里云。
> **AI 会话的活到「合并 + CI 绿」为止**，不在本地 build / test / deploy，不做浏览器 QA，不为部署单独取证。
> **生产切流只走 `Deploy` 工作流**（GitHub Actions → Run workflow，或 `scripts/deploy-now.sh <target> [commit]`），且必须明确一个 `release_target`：记回滚点 → 记录固定 15 域名基线 → 原子切 `current` → 重启一个目标服务 → 等 READY → 对比 15 域名前后状态并检查目标公网入口（任一异常自动弹回）。15 域名用于证明共享站点未因本次发布发生变化，不要求旧站点预先全部返回 200；Console 目标另按节点检查 `console.fufu.wang` 或 `console.hbbtzn.com` 返回 200。Caddy 仍以归一化语义摘要判定是否发生变化。
> 文档、测试和夹具变化可以运行直接相关验证；没有生产目标时不构建制品、不暂存候选、不重启服务。

## 目标图发布

发布计划只回答五件事：哪些文件变化、哪些运行目标实际消费变化、必须做哪些验证、每个目标产生什么制品、目标按什么顺序部署。工作区依赖变化沿真实 workspace 依赖图展开；共享服务代码沿真实入口依赖图展开；数据库迁移使用独立 `database-migration` 目标且永远排在同一提交的服务消费者之前。

SRI-008 制品来源、SRI-009 目标隔离、SRI-010 恢复证据只证明发布结果，不参与授权和放行。除权限池明确裁决外，发布引擎不根据分支数量、测试数量、历史文档或 AI 风险判断阻塞目标。

## 不可绕过的发布秩序

1. 制品只在构建端生成一次；生产机不运行 `npm ci`，也不从源码构建。
2. 每个制品都有内容哈希、清单哈希和关键文件哈希；远端复验后才能成为候选。
3. 上传前必须按来源提交、归档摘要、清单摘要和内容树摘要查询；完全相同的不可变制品直接复用，实际上传严格为 0 字节。
4. 节点、服务和生产切流使用真实互斥锁。锁冲突立即报告持有者，不静默排队。
5. 每个节点、每个服务拥有独立 `candidate/current/previous`；L0 与 L1 不共享指针、锁或回滚点。
6. 生产切流使用查询时的 `current` 做比较并交换；指针中途改变立即停止。同一制品已在生产时只验收，不重启、不移动指针。
7. 候选失败不切流；切流后健康失败自动恢复旧指针并重启原服务。
8. 生产切流必须同时满足两次明确授权：用户回复“开始部署”，命令携带与制品提交一致的 `--approve-production zdt-next:<完整 SHA>`。
9. 每次发布输出 `plan/tests/typecheck/build/package/artifactLookup/upload/candidate/cutover/health/total` 的真实耗时，以及制品、上传和复用字节数。没有计时证据，不得宣称速度达标。
10. `93195ddf` 的版本保留、磁盘阈值与自动回收规则是本引擎的 retention 模块，不得移除。
11. 禁止临时 SSH 命令、手工移动 `current`、整仓复制、服务器现场构建，或由另一任务绕过本入口重启服务。

## 隔离工作区准备

发布构建不得借用另一个工作区的 `node_modules` 符号链接，否则可能读取对方尚未提交的契约或生成物。新 worktree 第一次构建前执行：

```bash
bash 04_tools/release-engine/adapters/zdt-next/prepare-isolated-dependencies.sh <可信依赖工作区>
node 04_tools/release-engine/adapters/zdt-next/assert-workspace-isolation.mjs
```

准备脚本通过硬链接复用同一磁盘上的依赖文件，不把依赖复制进发布制品，也不污染 Git。

## 一次性生产接线

首次启用独立服务指针必须分开执行：

1. 通过统一入口执行 `install --mode agent`：只安装远端代理、允许清单和目录，不改进程与流量；安装包只允许包含清单内的代理、策略和服务定义，且工作区必须已提交并保持干净；
2. 对每个可重启目标执行带精确 SHA 授权的 `seed`，从现网建立不可变 `current`、回滚基线及 Storefront 依赖层；
3. 按节点执行 `install --mode runtime-candidate --node <node>`：只有该节点全部必需指针存在时才安装该节点的候选服务定义，只执行配置重载，不启动或重启服务；一个节点未就绪不得阻塞另一个节点；
4. 候选验收后另行取得 Ethan 的“开始部署”，再执行首次生产切换。

安装器会读取阿里云实例元数据，只接受 `i-2zeewhay0farxq8lucrd`；目标不符立即拒绝。
安装、候选复用、激活和回滚都会把允许清单内的目标指针根及其受管父目录统一为 `0755`，保证 systemd `DynamicUser` 只能穿越并读取不可变制品；制品文件本身的只读边界不变。
生产健康检查采用 30 秒单调时钟就绪窗口和 500 毫秒轮询；连接拒绝及启动阶段的非成功响应会重试，进程明确失败或窗口到期则立即恢复旧 `current/runtime`。回滚开始耗时、指针恢复、服务重启和旧版本重新 READY 分开记录，只有旧版本 READY 才报告回滚成功。

每个 systemd 目标只拥有一个重启 unit，激活与回滚均使用 `jobMode=ignore-dependencies`；Gateway、Tunnel 与业务服务只保留 `Wants=`/`After=` 软依赖和启动顺序，不使用会传播停止、失败或重载的生命周期绑定。代理逐次记录目标 unit、实际重启命令数量及受保护服务 PID；任一非目标 PID 改变即失败。

## 项目适配边界

通用内核位于 `04_tools/release-engine/`，不包含任何业务域名、节点名或服务名。项目差异只写入：

- 构建端适配器：`02_platform_pingtai/infrastructure/release/zdt-next.release.json`
- 服务器允许清单：`02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json`

其他项目接入时新增自己的适配器和远端策略，不复制或修改通用内核。生产服务器只接受远端策略明确列出的项目、节点、目标、指针和进程。

## 当前部署停止点

仓库实现、测试和候选验收可以继续；安装远端代理、迁移独立指针、修改服务定义或切换生产流量，必须停下并向 Ethan 提交精确语义差异，等待“开始部署”。

`database-migration` 当前建立了独立计划、验证、制品、候选和顺序通道，不重启任何服务。生产数据库执行器尚未接入；在该执行器完成前，它发布的是迁移候选与来源证据，不宣称 SQL 已应用。此事实不影响任何非数据库目标继续生成和暂存候选。

当前候选的真实计时、十项场景和生产停止点记录在
`05_docs_ziliao/docs_wendang/architecture/evidence/AI-release-engine-candidate-2026-09-09.md`。
