# 全项目统一 AI 发布入口

本文件是本仓库所有人和所有 AI 的发布权威入口。业务开发工具可以不同，生产发布不得各自拼装命令。

## 唯一入口

```bash
npm run release -- plan --from <base> --to <commit> [--node <node>]
npm run release -- install --mode <agent|verify> --source-sha <commit> --approve-install zdt-next:install:<commit>
npm run release -- install --mode runtime-candidate --node <node> --source-sha <commit> --approve-install zdt-next:install:<commit>
npm run release -- build --plan <plan.json>
npm run release -- package --build <build.json>
npm run release -- deploy --package <package.json> --node <node> --environment candidate
npm run release -- verify --node <node> --target <target>
npm run release -- status [--node <node> --target <target>]
npm run release -- rollback --node <node> --target <target>
```

任何 AI 在发布前必须先运行 `plan`，并以计划输出的等级、目标、测试、产物、指针和重启范围为准。无法分类的改动关闭式升级为 A3。

## 四条通道

| 等级 | 适用范围 | 目标时间 | 禁止事项 |
| --- | --- | ---: | --- |
| A0 | 商品图、运营媒体 | 10–60 秒 | 不构建、不重启应用 |
| A1 | 单一 Web 客户端 | 2–8 分钟 | 不上传整仓、不移动节点总指针 |
| A2 | 依赖图确认只影响一个服务 | 8–15 分钟 | 不重启非目标服务 |
| A3 | 数据库、网络、环境、节点内核或多服务改动 | 30–60 分钟 | 不削减完整门禁与回滚流程 |

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

首次启用独立服务指针属于 A3，必须分开执行：

1. 通过统一入口执行 `install --mode agent`：只安装远端代理、允许清单和目录，不改进程与流量；安装包只允许包含清单内的代理、策略和服务定义，且工作区必须已提交并保持干净；
2. 对每个可重启目标执行带精确 SHA 授权的 `seed`，从现网建立不可变 `current`、回滚基线及 Storefront 依赖层；
3. 按节点执行 `install --mode runtime-candidate --node <node>`：只有该节点全部必需指针存在时才安装该节点的候选服务定义，只执行配置重载，不启动或重启服务；一个节点未就绪不得阻塞另一个节点；
4. 候选验收后另行取得 Ethan 的“开始部署”，再执行首次生产切换。

安装器会读取阿里云实例元数据，只接受 `i-2zeewhay0farxq8lucrd`；目标不符立即拒绝。
安装、候选复用、激活和回滚都会把允许清单内的目标指针根及其受管父目录统一为 `0755`，保证 systemd `DynamicUser` 只能穿越并读取不可变制品；制品文件本身的只读边界不变。
生产健康检查采用 30 秒单调时钟就绪窗口和 500 毫秒轮询；连接拒绝及启动阶段的非成功响应会重试，进程明确失败或窗口到期则立即恢复旧 `current/runtime`。回滚开始耗时、指针恢复、服务重启和旧版本重新 READY 分开记录，只有旧版本 READY 才报告回滚成功。

A1/A2 的每个 systemd 目标只拥有一个重启 unit，激活与回滚均使用 `jobMode=ignore-dependencies`；Gateway、Tunnel 与业务服务只保留 `Wants=`/`After=` 软依赖和启动顺序，不使用会传播停止、失败或重载的生命周期绑定。代理逐次记录目标 unit、实际重启命令数量及受保护服务 PID；任一非目标 PID 改变即失败。

## 项目适配边界

通用内核位于 `04_tools/release-engine/`，不包含任何业务域名、节点名或服务名。项目差异只写入：

- 构建端适配器：`02_platform_pingtai/infrastructure/release/zdt-next.release.json`
- 服务器允许清单：`02_platform_pingtai/infrastructure/release/zdt-next.remote-policy.json`

其他项目接入时新增自己的适配器和远端策略，不复制或修改通用内核。生产服务器只接受远端策略明确列出的项目、节点、目标、指针和进程。

## 当前部署停止点

仓库实现、测试和候选验收可以继续；安装远端代理、迁移独立指针、修改服务定义或切换生产流量，必须停下并向 Ethan 提交精确语义差异，等待“开始部署”。

当前 `catalog-media`、`auth-web`、`console` 尚未证明现网读取独立指针，`core` 仍应走现有完整 A3 迁移流程，因此生产激活被双端策略明确禁用。它们可以生成计划和候选，但不能被本引擎误切生产。

当前候选的真实计时、十项场景和生产停止点记录在
`05_docs_ziliao/docs_wendang/architecture/evidence/AI-release-engine-candidate-2026-09-09.md`。
