# AI 发布通道 1.3（预构建不可变制品）

生产发布分成两个互不混合的动作：GitHub `Prepare Artifact` 生成制品，GitHub `Deploy` 只部署已经存在的制品。两条通道一次都只接受一个 target；不支持空目标、affected 或多目标扇出。

## 用户入口与授权

Ethan 在当前任务中输入“部署”即为生产授权。AI 只部署已存在的精确制品，不得在 Deploy 中修代码、安装依赖、测试、构建、打包、发布制品、推送分支或建设通道。目标或完整 40 位 source SHA 不明确时只询问缺失项。

通道建设、Prepare 和 Deploy 是三个不同动作。建设完成后必须停止；Prepare 完成后也不得顺带 Deploy。生产切流仍须 Ethan 在独立任务中明确输入“部署”。

本地生产触发入口保持不变：

```bash
scripts/deploy-now.sh <target> <full-source-sha> <node>
```

## Prepare Artifact（构建通道）

`.github/workflows/prepare-artifact.yml` 接受一个完整 source SHA 和一个 target：

```text
精确 checkout → dependency cache（仅加速）→ npm ci
  → 目标测试/类型检查 → 生产构建 → 确定性打包
  → Linux x64 运行验收（Storefront）→ OSS 不可变发布
```

统一命令是：

```bash
npm run release -- plan --from <parent-sha> --to <source-sha> --target <target> --prepare
npm run release -- build --plan <plan.json>
npm run release -- package --build <build.json>
npm run release -- publish --package <package.json> --source-sha <source-sha> --target <target> \
  --npm-version <version> --runner-image <image> --output <prepare-receipt.json>
```

GitHub dependency cache 只减少重复下载。缓存丢失会触发重新安装和构建，不会改变制品身份，也不能被 Deploy 使用。GitHub Actions receipt artifact 只保存审计回执；唯一可部署来源是 OSS。

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

## Deploy（纯部署通道）

`.github/workflows/deploy.yml` 必须输入一个完整 source SHA、一个 node 和一个 target。它只稀疏读取当前发布控制面，不 checkout 业务源版本，不执行 `npm ci`、测试、类型检查、构建、打包或上传。

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
npm run release -- deploy-prepared --source-sha <source-sha> --node <node> --target <target>
```

OSS 中制品不存在、对象下载失败、摘要/清单不符或 project/target/node/source SHA 不符时，远端切换不会开始。同一精确制品可重复部署；ECS 已有不可变版本时跳过下载并执行健康复核。相同制品也可部署到清单声明的其他节点，不重新构建。

预签名下载 URL 只经 stdin 交给远端 Agent，不进入命令参数、回执或审计日志。凭据只来自现有 GitHub Secrets；仓库、制品和回执不保存凭据。

## 计时与回执

Prepare 单独报告 `plan/tests/typecheck/build/materialize/package/publication/total`；Deploy 单独报告 `artifactLookup/download/candidate/cutover/restart/health/remoteTotal/total`。不得把 Prepare 时间算进 Deploy，也不得为缩短数字删除摘要校验、候选检查、健康检查或回滚。

## 兼容与启用顺序

Storefront 继续使用 1.2 的自包含生产运行包和现有 systemd 单元，不恢复 `node_modules` 依赖层。1.3 复用现有候选目录、current/previous 指针、健康检查、回滚回执和单目标锁；只为远端 Agent 增加 OSS 下载动作。

生产启用必须作为独立任务执行：合并 1.3 → 安装并验证新版远端 Agent → 配置/核对 OSS 最小权限与 Endpoint → 手工 Prepare 一个目标 → 仅做候选解析验证 → Ethan 再次明确“部署”后才允许首次生产切流。

## E06 一次性 staging 验收

E06 的 Sovereign 验收仍通过现有入口：

```bash
npm run release -- accept-e06 --from <artifact-A-ref> --to <artifact-B-ref>
```

该命令只操作一次性 Docker staging，不连接生产主机或修改生产指针。
