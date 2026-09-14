# AI 发布通道（正式 1.3.2 阿里云版）

1.3.2 是仓库唯一默认发布协议：GitHub 负责任务调度；系统级 Prepare 在阿里云 Build 槽有容量时优先使用阿里云，两个槽都忙或离线时将新任务送往 GitHub 托管 Runner，选择后不再迁移；候选封板与发布固定由阿里云 Release Runner 执行。`Prepare Artifact 1.3.2 - Aliyun` 生成不可变 OSS 制品并封板，`Deploy 1.3.2 - Aliyun Sealed Artifact` 只消费已封板制品。候选验证必须证明当前生产 source SHA 是候选 source SHA 的 Git 祖先，并把精确制品、候选目录、当前生产指针、Agent 和策略摘要写入封板记录；正式部署不能临时下载候选、安装依赖或构建。两条正常入口一次只接受一个物理 target，固定从 `zdt-next` 触发，source SHA 必须属于精确 `zdt-next` 历史。

默认分支当前使用文件名带 `-aliyun` 的工作流，新分支从 `zdt-next` 创建后自然继承 1.3.2；历史分支中的旧 YAML 只是历史快照，不是可执行入口。旧 GitHub workflow ID 已删除。1.2 仅以两个名称明确的恢复入口保留，不再要求重复确认字符串；普通“部署”仍进入 1.3.2。

1.3.2 不用测试锁死工作流数量、文件名、Action 版本或 Runner 标签。阿里云是当前默认配置，未来正常演进可以直接修改；只有精确制品、物理目标、原子回滚和健康检查属于运行时安全条件。发布安全测试可人工执行，但不接入总质量门禁或生产 Deploy。

## 当前状态与迁移边界

截至 2026-09-14，1.3 已由两个真实生产目标完成 Prepare、候选验证和生产切换，足以证明通道成立并可持续使用：

| 生产部署位 | 业务 source SHA | 1.3 生产回执 | 状态 |
| --- | --- | --- | --- |
| `hbbtzn-l1/storefront` | `768ff86f22f0d28da69ef51a572706054fc4163d` | [GitHub run 34774901585](https://github.com/Ethan7586/zhudatuan/actions/runs/34774901585) | 已迁移，旧版本可回滚 |
| `hbbtzn-l1/console` | `2bd31e9f4b3c3af95b9f7df5a42df0ef31019b34` | [GitHub run 34777531642](https://github.com/Ethan7586/zhudatuan/actions/runs/34777531642) | 已迁移，旧版本可回滚 |

生产覆盖率是后续迁移进度，不是通道成立的门禁。不得为了追求覆盖率连续扰动生产；以后哪个目标本来就需要发布，就先通过 1.3.2 Prepare 完成该部署位的候选封板，再等待独立“部署”口令。数据库迁移最后处理。

全面删除 1.2 恢复入口仍需覆盖全部 L0/L1 生产部署位，并为 `h6-cdn` 等 L2/边缘能力完成独立安置。此前，1.2 只作为人工确认的恢复工具保留；它会安装依赖和构建，不能被称为或用作 1.3.2。

## 用户入口与授权

Ethan 每次在独立任务中输入“部署”才是该次 1.3.2 生产授权。AI 只部署已经验证并封板的精确候选，不得在 Deploy 1.3.2 中修代码、安装依赖、测试、构建、打包、发布制品、下载缺失候选、推送分支、修改 Caddy 或建设通道。目标、真实物理节点或完整 40 位 source SHA 不明确时只询问缺失项；封板不存在、生产基线无法识别或封板后 current 变化时立即停止。

通道建设、Prepare 和 Deploy 是三个不同动作。建设完成后必须停止；Prepare 完成后也不得顺带 Deploy。生产切流仍须 Ethan 在独立任务中明确输入“部署”。

## 通道与部署严格分离

- 目标没有现成通道时，部署立即停止并报告“通道尚未建立”。
- “部署”不得创建或修改工作流、脚本、制品路径、SSH、ECS、数据库或其他基础设施。
- 只有 Ethan 明确要求建立目标通道时才允许建设；通道建成后停止，等待新的“部署”口令。
- 部署不等待或调用测试、类型检查、候选、审批、外部基线或浏览器验收。
- 部署耗时只计算 GitHub Deploy 工作流从触发到成功或失败终态的时间。

候选准备与封板入口是：

```bash
scripts/prepare-release.sh <target> <full-source-sha> <physical-node>
```

它完成后必须停止，绝不切换生产。

独立授权后的唯一正常生产入口是：

```bash
scripts/deploy-now.sh <target> <full-source-sha> <physical-node>
```

三个参数都必须明确，不接受默认值。`scripts/deploy-now.sh` 只转发到 `scripts/deploy-prepared.sh`。

## 旧恢复入口与 H6 CDN

H6 阿里云 CDN 暂时只存在于显式的 1.2 直接恢复入口，登记目标为 `h6-cdn`；它不属于 L1 通用 1.3.2 运行时部署。状态、通道建立意图和回滚统一通过：

```bash
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action status
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action establish
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action rollback
```

建立通道不得执行 `--action deploy`；首次切流仍须等待新的“部署 H6”口令。

## Prepare Artifact（构建通道）

`.github/workflows/prepare-artifact-aliyun.yml` 接受一个完整 source SHA 和一个 target：

## Prepare 唯一执行链

```text
精确 checkout → 固定 ubuntu-24.04 x64 / Node 22.22.0 / npm 10.9.4
  → 阿里云 Runner 本地 npm 缓存（不上传 GitHub Actions cache）
  → 隔离空状态根 A：目标测试/类型检查 → 生产构建 → 冷打包 miss
  → 隔离空状态根 B：目标测试/类型检查 → 生产构建 → 冷打包 miss
  → 比较 tree/manifest/archive/大小/完整文件清单
  → Linux x64 运行验收（Storefront）→ OSS 不可变发布
```

统一命令是：

```bash
npm run release -- plan --state-directory <cold-root-a> --from <parent-sha> --to <source-sha> --target <target> --prepare
npm run release -- build --state-directory <cold-root-a> --plan <plan-a.json>
npm run release -- package --state-directory <cold-root-a> --build <build-a.json>
# 对 cold-root-b 独立重复以上三步，双方 packageCache 必须都是 miss
npm run release -- verify-reproducibility --left-package <package-a.json> --right-package <package-b.json>
npm run release -- publish --package <package.json> --source-sha <source-sha> --target <target> \
  --npm-version <version> --runner-image <image> --output <prepare-receipt.json>
```

阿里云 Runner 的本地 npm 缓存只减少重复下载。缓存丢失会触发重新安装和构建，不会改变制品身份，也不能被 Deploy 使用。禁止 GitHub Actions cache 上传，避免生产切换后卡在缓存收尾。GitHub Actions receipt artifact 只保存审计回执；唯一可部署来源是 OSS。

Storefront publish 必须读取完整运行证据并 fail closed：`ok=true`、Linux x64、Node 22.22.0、制品内无 `node_modules`，首页/H5/动态路由均返回有效 HTML，且哈希静态资源完成 200、immutable cache 与 304 验证。任一字段缺失或不符时，在任何 OSS 对象上传前停止。

## 现役 Deploy 唯一执行链

```text
精确 Git SHA
  → GitHub Deploy（单 Job）
  → 只运行生产构建
  → 上传阿里云不可变版本目录
  → 记录 previous
  → 原子切换 current
  → 重启目标服务
```

`h6-cdn` 是边缘路由目标，其唯一执行链为：精确 Git SHA → GitHub `Deploy` 单 Job → 直连源站与 CDN CNAME 探测 → Cloudflare DNS 原子切换。它不改运行制品指针、不重启业务服务。

部署不依赖 `.github/workflows/quality.yml`。Affected Delivery 仅可被人工单独调用，不能成为 Deploy 的前置任务。

## 不属于门禁的机械约束

- Git SHA 必须精确，避免其他任务的提交混入。
- 制品传输保留摘要和路径安全检查，避免传输损坏或目录逃逸。
- 同一节点和目标使用互斥锁，避免两个发布同时改写指针。
- 每次切换保存 previous；重启命令失败时恢复旧指针。
- 应用构建、SSH 传输或服务重启命令自身失败，表示部署没有完成，不是额外审批。

## 发布引擎直达模式

`--direct` 只执行构建、制品生成、传输和切换：

```bash
node 04_tools/release-engine/cli.mjs plan --from <base> --to <sha> --node <node> --direct
node 04_tools/release-engine/cli.mjs build --plan <plan.json>
node 04_tools/release-engine/cli.mjs package --build <build.json>
node 04_tools/release-engine/cli.mjs deploy --package <package.json> --node <node> --environment production --direct
```

直达模式不运行 tests、typecheck、build preflight、candidate checks、production approval、remote preflight、health checks 或 external baseline。

## OSS 制品协议

每个对象都以内容摘要命名，基础前缀为：

```text
ai-delivery/v1/<project>/<target>/<full-source-sha>/<artifact-sha256>/
```

目录内有三种不可变对象：

```text
artifact-<artifact-sha256>.tar.gz
artifact-manifest-<manifest-file-sha256>.json
release-manifest-<release-manifest-file-sha256>.json
```

`release-manifest` 记录 project、target、完整 source SHA、可用节点、运行制品与运行清单摘要、构建平台/架构/Node/npm/Runner 版本、父提交、计划与 lockfile 摘要、执行过的验证、Storefront Linux x64 运行证据，以及保留策略。时间戳和 GitHub run id 只进入 receipt，不进入制品身份。

上传使用 `x-oss-forbid-overwrite: true`。同名对象存在时必须验证长度与 SHA-256 后报告 `hit_remote`；内容不同则停止。相同 source SHA/target 若出现两个不同 release manifest，Deploy 报 `OSS_ARTIFACT_AMBIGUOUS`，不得自行选择。

1.3 不删除任何 OSS 制品。生命周期清理在建立“读取全部节点 current/previous 指针并生成保护集”的独立回收器之前保持关闭；未来至少保留每个节点当前版和回滚版，建议普通制品至少保留 90 天。当前或回滚所需对象不得由日期规则直接删除。

## Deploy 1.3.2（阿里云封板候选纯部署通道）

`.github/workflows/deploy-prepared-aliyun.yml` 必须输入完整 source SHA、真实物理 node 和单个 target。默认操作是 `validate-candidate`，只解析、下载、校验并设置候选，不移动 current；随后读取当前运行制品的 source SHA，由 GitHub 比较证明当前生产版本是候选版本的祖先，再由远端 Agent 在目标锁内复核 current 未变化并写入封板记录。`deploy` 只由 Ethan 的“部署”口令触发。逻辑节点若声明 `hostedBy` 指向其他节点，工作流必须拒绝并要求填写物理宿主。工作流只稀疏读取当前发布控制面，不 checkout 业务源版本，不执行 `npm ci`、测试、类型检查、构建、打包或上传。

```text
候选阶段：OSS 前缀查询 → 唯一 release manifest
  → project/target/node/source SHA/manifest/SHA-256/长度校验
  → ECS 下载并验证候选 → current 保持不变
  → 当前生产 source SHA 血缘核对 → 写入不可替代的候选封板记录

部署阶段：读取 OSS manifest 身份 → 核对本机候选与封板
  → 核对 current 仍等于封板基线 → previous 回滚点 → 原子 current 切换
  → 仅重启目标服务 → 最长 30 秒健康检查
  → 成功回执；失败自动恢复旧指针并复验旧版本
```

统一命令是：

```bash
npm run release -- validate-prepared --source-sha <source-sha> --node <node> --target <target> \
  --control-sha <workflow-sha> --github-run-id <run-id> --github-run-attempt <attempt> \
  --expected-remote-agent-sha256 <sha256> --expected-remote-policy-sha256 <sha256>
npm run release -- deploy-prepared --source-sha <source-sha> --node <node> --target <target> \
  --control-sha <workflow-sha> --github-run-id <run-id> --github-run-attempt <attempt> \
  --expected-remote-agent-sha256 <sha256> --expected-remote-policy-sha256 <sha256>
```

Deploy 1.3.2 只接受仓库固定的 ECS Ed25519 主机键（指纹 `SHA256:k5H7lupovyWgtjZJWrB4nmeLc0T1CpBN5FR/Xd3qmW8`），禁止运行时 `ssh-keyscan`。控制面从精确 checkout 计算 Agent 与 policy 摘要并调用 v3 远端动作；Agent 在候选验证、封板和切换前自校验，动作完成后的回执再逐值复核。OSS 中制品不存在、对象下载失败、摘要/清单不符或 project/target/node/source SHA 不符时，候选不能封板；封板不存在、候选身份不同、Agent/策略变化或 current 不再等于封板基线时，部署不能开始。

## 后端单目标边界

1.3.2 不接受旧 `commerce-api` 或 `workers` 组合目标。后端只允许 `identity-api`、`mall-provisioning-api`、`support-api`、`purchase-api`、`web-api`、`catalog-api`、`payment-webhook-api`、`identity-notification-jobs`、`catalog-jobs`、`payment-jobs` 和 `database-migration` 等单一运行目标。每个目标拥有自己的指针、运行服务、健康检查和回滚点；共享同一 source SHA 不等于组合切换。网关/Caddy 不属于这些制品，缺路由时停止并转入独立基础设施任务。

预签名下载 URL 只经 stdin 交给远端 Agent，不进入命令参数、回执或审计日志。凭据只来自现有 GitHub Secrets；仓库、制品和回执不保存凭据。

## 计时与回执

Prepare 单独报告两次冷构建摘要、确定性比较和 `plan/tests/typecheck/build/materialize/package/publication/total`；候选验证单独报告下载、校验、血缘和封板；Deploy 1.3.2 单独报告 `artifactLookup/candidate/cutover/restart/health/remoteTotal/total`，其中下载必须为零。生产回执把业务制品 `sourceSha` 与控制面 `controlPlane.sourceSha` 分开，并记录 GitHub run id/attempt、远端 Agent 文件 SHA-256 和远端 policy SHA-256。签名 URL、OSS 凭据和 SSH 密钥不得进入回执。

## 兼容与启用顺序

Storefront 的 1.3 路径继续使用既有自包含生产运行包和现有 systemd 单元，不恢复 `node_modules` 依赖层。1.3 复用现有候选目录、current/previous 指针、健康检查、回滚回执和单目标锁；只为远端 Agent 增加 OSS 下载动作。

1.3 首次生产启用序列已经由 Storefront 和 Console 完成。1.3.2 的固定序列是：核对 OSS/凭据/Endpoint → 安装并验证仓库精确 Agent → Prepare 单一目标 → `validate-candidate` 取得血缘证明与封板 → 停止 → Ethan 在独立任务中明确“部署” → 仅消费封板并原子切换生产。任一前置步骤失败都停止，不在部署现场修复。

任何数量的 1.3.2 生产部署成功都不自动删除 1.2 恢复入口。只有全部 L0/L1 生产部署位完成迁移、L2/边缘能力完成独立安置，并且后续清理任务获得 Ethan 明确授权后，才允许删除两个显式恢复工作流。

## E06 一次性 staging 验收

E06 的 Sovereign 验收仍通过现有入口：

```bash
npm run release -- accept-e06 --from <artifact-A-ref> --to <artifact-B-ref>
```

该命令只操作一次性 Docker staging，不连接生产主机或修改生产指针。
