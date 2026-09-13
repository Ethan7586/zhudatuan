# AI 发布通道（1.2 兜底与正式 1.3）

1.3 已完成通道建设并作为正式可用的并行生产通道运行：GitHub `Prepare Artifact` 生成制品，GitHub `Prepared Deploy` 验证或部署已经存在的制品。现有 1.2 `Deploy`、`Deploy via Wuhan OSS` 和 `scripts/deploy-now.sh` 保持原样，继续承接尚未自然迁移的运行目标以及 `h6-cdn` 等 L2/边缘能力。1.3 两条工作流一次都只接受一个 target；不支持空目标、affected 或多目标扇出；工作流必须从 `zdt-next` 触发，source SHA 必须属于该次精确 `zdt-next` 控制提交的历史。

## 当前状态与迁移边界

截至 2026-09-14，1.3 已由两个真实生产目标完成 Prepare、候选验证和生产切换，足以证明通道成立并可持续使用：

| 生产部署位 | 业务 source SHA | 1.3 生产回执 | 状态 |
| --- | --- | --- | --- |
| `hbbtzn-l1/storefront` | `768ff86f22f0d28da69ef51a572706054fc4163d` | [GitHub run 34774901585](https://github.com/Ethan7586/zhudatuan/actions/runs/34774901585) | 已迁移，旧版本可回滚 |
| `hbbtzn-l1/console` | `2bd31e9f4b3c3af95b9f7df5a42df0ef31019b34` | [GitHub run 34777531642](https://github.com/Ethan7586/zhudatuan/actions/runs/34777531642) | 已迁移，旧版本可回滚 |

生产覆盖率是后续迁移进度，不是 1.3 通道成立的门禁。不得为了追求覆盖率连续扰动生产；以后哪个目标本来就需要发布，就通过 1.3 完成该部署位的第一次自然迁移。未迁移目标继续使用 1.2，数据库迁移和多服务组合目标最后处理。

全面替代 1.2 需要最终覆盖全部 L0/L1 生产部署位；退役整个 1.2 还需要为 `h6-cdn` 等 L2/边缘能力完成独立安置。两项条件都满足并获得 Ethan 的独立清理授权前，1.2 必须继续保留。

## 用户入口与授权

Ethan 每次在独立任务中输入“部署”才是该次 1.3 生产授权。AI 只部署已存在的精确制品，不得在 Prepared Deploy 中修代码、安装依赖、测试、构建、打包、发布制品、推送分支或建设通道。目标或完整 40 位 source SHA 不明确时只询问缺失项。

通道建设、Prepare 和 Deploy 是三个不同动作。建设完成后必须停止；Prepare 完成后也不得顺带 Deploy。生产切流仍须 Ethan 在独立任务中明确输入“部署”。

## 通道与部署严格分离

- 目标没有现成通道时，部署立即停止并报告“通道尚未建立”。
- “部署”不得创建或修改工作流、脚本、制品路径、SSH、ECS、数据库或其他基础设施。
- 只有 Ethan 明确要求建立目标通道时才允许建设；通道建成后停止，等待新的“部署”口令。
- 部署不等待或调用测试、类型检查、候选、审批、外部基线或浏览器验收。
- 部署耗时只计算 GitHub Deploy 工作流从触发到成功或失败终态的时间。

  1.2 本地生产触发入口保持不变：

```bash
scripts/deploy-now.sh [target] [full-source-sha] [node]
```

参数留空时使用 GitHub `zdt-next` 的精确 HEAD 和 `hbbtzn-l1`；目标必须已由上下文明确，不能借空参数扩大到全部受影响目标。

独立授权后的 1.3 生产触发入口是：

```bash
scripts/deploy-prepared.sh <target> <full-source-sha> <node>
```

## 现役 Deploy 与 H6 CDN

H6 阿里云 CDN 使用同一个 GitHub `Deploy` 工作流，登记目标为 `h6-cdn`。它不重新构建 Storefront 制品，只在确认阿里云 CDN、HTTPS、直连源站和预切流探测均正常后，把 H6 的 Cloudflare DNS 从 Tunnel 回滚点切换到阿里云 CDN CNAME。状态、通道建立意图和回滚统一通过：

```bash
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action status
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action establish
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action rollback
```

建立通道不得执行 `--action deploy`；首次切流仍须等待新的“部署 H6”口令。

## Prepare Artifact（构建通道）

`.github/workflows/prepare-artifact.yml` 接受一个完整 source SHA 和一个 target：

## Prepare 唯一执行链

```text
精确 checkout → 固定 ubuntu-24.04 x64 / Node 22.22.0 / npm 10.9.4
  → dependency cache（只加速 npm ci）
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

GitHub dependency cache 只减少重复下载。缓存丢失会触发重新安装和构建，不会改变制品身份，也不能被 Deploy 使用。GitHub Actions receipt artifact 只保存审计回执；唯一可部署来源是 OSS。

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

## Prepared Deploy（1.3 纯部署通道）

`.github/workflows/deploy-prepared.yml` 必须输入一个完整 source SHA、一个 node 和一个 target。默认操作是 `validate-candidate`，只解析、下载、校验并设置候选，不移动 current。`deploy` 只由 Ethan 的“部署”口令触发，不再接收脚本可自动生成的第二授权字符串。工作流只稀疏读取当前发布控制面，不 checkout 业务源版本，不执行 `npm ci`、测试、类型检查、构建、打包或上传。

```text
OSS 前缀查询 → 唯一 release manifest
  → project/target/node/source SHA/manifest/SHA-256/长度校验
  → ECS 通过同地域 OSS 内网 Endpoint 下载
  → 远端再次校验 manifest 与 SHA-256
  → 候选检查 → previous 回滚点 → 原子 current 切换
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

Prepared Deploy 只接受仓库固定的 ECS Ed25519 主机键（指纹 `SHA256:k5H7lupovyWgtjZJWrB4nmeLc0T1CpBN5FR/Xd3qmW8`），禁止运行时 `ssh-keyscan`。当前控制面从精确 checkout 计算 Agent 与 policy 摘要并调用 v2 远端动作；新 Agent 在下载、加锁和切换前自校验，旧 Agent 因不认识 v2 动作直接拒绝，动作完成后的回执再逐值复核。只有格式正确但值不同同样停止。OSS 中制品不存在、对象下载失败、摘要/清单不符或 project/target/node/source SHA 不符时，远端切换不会开始。同一精确制品可重复部署；ECS 已有不可变版本时跳过下载并执行健康复核。相同制品也可部署到清单声明的其他节点，不重新构建。

预签名下载 URL 只经 stdin 交给远端 Agent，不进入命令参数、回执或审计日志。凭据只来自现有 GitHub Secrets；仓库、制品和回执不保存凭据。

## 计时与回执

Prepare 单独报告两次冷构建摘要、确定性比较和 `plan/tests/typecheck/build/materialize/package/publication/total`；Prepared Deploy 单独报告 `artifactLookup/download/candidate/cutover/restart/health/remoteTotal/total`。生产回执把业务制品 `sourceSha` 与控制面 `controlPlane.sourceSha` 分开，并记录 GitHub run id/attempt、远端 Agent 文件 SHA-256 和远端 policy SHA-256。签名 URL、OSS 凭据和 SSH 密钥不得进入回执。不得把 Prepare 时间算进 Deploy，也不得为缩短数字删除摘要校验、候选检查、健康检查或回滚。

## 兼容与启用顺序

Storefront 的 1.3 路径继续使用既有自包含生产运行包和现有 systemd 单元，不恢复 `node_modules` 依赖层。1.3 复用现有候选目录、current/previous 指针、健康检查、回滚回执和单目标锁；只为远端 Agent 增加 OSS 下载动作。

1.3 首次生产启用序列已经由 Storefront 和 Console 完成：保留 1.2 → 核对 OSS/凭据/Endpoint → 安装并验证新版远端 Agent → Prepare 单一目标 → 运行 `validate-candidate` → Ethan 在独立任务中明确“部署” → 原子切换生产。后续目标仍按同一顺序自然迁移，任一前置步骤失败都停止该目标的 1.3 操作并继续使用 1.2。

任何数量的 1.3 生产部署成功都不自动退役 1.2。只有全部 L0/L1 生产部署位完成迁移、L2/边缘能力完成独立安置，并且后续清理任务获得 Ethan 明确授权后，才允许删除旧工作流或改变 `scripts/deploy-now.sh`。

## E06 一次性 staging 验收

E06 的 Sovereign 验收仍通过现有入口：

```bash
npm run release -- accept-e06 --from <artifact-A-ref> --to <artifact-B-ref>
```

该命令只操作一次性 Docker staging，不连接生产主机或修改生产指针。
