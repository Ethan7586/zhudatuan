# GitHub Actions Runner（1.4.3，REFERENCE）

Prepare 的系统级入口和自动封板共用 OSS 原子租约选择构建位置：北京 ECS 上有可领取 Build 逻辑槽时优先阿里云；两个槽都忙、离线或租约已满时，新任务使用 GitHub 标准托管 `ubuntu-24.04`。候选封板及生产切换仍由取得 Release Writer Lease 的阿里云 Release Runner 执行。

## Build Runner 选择

通常不需要指定 Runner。需要固定某一次构建位置时可以显式覆盖：

```bash
ZDT_PREPARE_RUNNER=github /Users/Ethan/.codex/bin/zdt-delivery prepare <target> <full-source-sha> <physical-node>
```

省略 `ZDT_PREPARE_RUNNER` 时使用自动模式；手工与自动入口都由 `prepare-artifact-aliyun.yml` 内的同一 request ID、请求租约和槽位 claim 选择 Runner。两种构建使用同一份工作流、Node 22.22.0、npm 10.9.4、双冷构建及运行证据，并写入现有 OSS 制品路径；GitHub 构建不配置生产 SSH。任务写入 started 后不能迁移，进入 UPLOADED 后直接恢复 Seal 生命周期。

## 固定拓扑

- 构建 Runner：标签 `self-hosted, linux, x64, zdt-aliyun-build`，只执行质量检查与 Prepare。
- 发布 Runner：标签 `self-hosted, linux, x64, zdt-aliyun-release`，只执行候选封板、基线登记和生产切换。
- 发布冷备用：与主发布位于同一台 staging ECS，只提供进程级冗余；启停状态和共同标签不是唯一写者证明。真正执行候选验证、Seal 或 Deploy 前必须通过 OSS Release Writer Lease 取得唯一写权，Standby 只能在 Primary 不可用且原租约过期后按相同请求身份接管。
- 同一物理目标由 GitHub concurrency 和远端目标锁共同串行化；增加 Runner 数量不能绕过目标锁。

两个现役 Runner 均以系统服务常驻。Runner 注册令牌只在安装时短暂使用，不写入仓库、工作流、日志或长期配置。访问 GitHub 的特殊线路由 ECS 本机网络层管理；阿里云 OSS、ECS 内网和生产业务流量保持直连。

当前固定为“3 个现役 + 1 个冷备用”：

- `aliyun-staging-zdt-build`：常驻构建，目录 `/opt/actions-runner-build`。
- `aliyun-staging-zdt-build-2`：第二个独立构建槽位，目录 `/opt/actions-runner-build-2`。
- `aliyun-staging-zdt-release`：常驻发布，目录 `/opt/actions-runner-release`。
- `aliyun-staging-zdt-release-standby`：只备份发布，目录 `/opt/actions-runner-release-standby`，正常状态必须为 offline。

只读查看 GitHub 登记状态：

```text
bash 02_platform_pingtai/infrastructure/github-actions-runner/runner-fleet-status.sh
```

Runner 连接 GitHub 的特殊线路必须在 systemd 服务启动时生效，不能等到 workflow checkout 之后再设置。`install-github-transport.sh` 只接受 `127.0.0.1` HTTP 代理，并明确让阿里云域名、元数据地址和 253 生产机直连；检测到任何运行中的 Runner 作业会立即停止安装。
Git 传输若连续 20 秒低于 1 KiB/s 会快速失败并交给现有重试，不再占住 Runner 直到整项工作流超时；健康线路不增加等待时间。

首次安装冷备用需要一次 GitHub 临时注册令牌；安装脚本固定校验 staging 实例 ID、Runner 压缩包摘要，安装完成后立即停止并禁用服务。切换命令只允许 `primary` 或 `standby` 二选一，不触碰 253 生产服务、OSS 制品或生产指针。

## 默认规则

1. 交付状态使用 `/Users/Ethan/.codex/bin/zdt-delivery status <target> <sha> <physical-node>` 只读查询；它统一显示“已提交、已入主线、已封板、可部署”，并在未入主线时列出可复现的冲突文件。状态查询不触发工作流、不构建、不封板、不部署，也不是代码门禁。
2. 默认分支 `zdt-next` 当前使用文件名带 `-aliyun` 的工作流入口；新分支从默认分支创建后自动继承。
3. 普通功能的正式部署使用 `/Users/Ethan/.codex/bin/zdt-delivery deploy-source <sha>`，它只读取该 SHA 自动封板时保存的目标清单，并按“迁移 → 运行服务 → 前端”三批调用现有原子部署。
4. 明确的单目标部署仍使用 `scripts/deploy-now.sh <target> <sha> <physical-node>`；手动制品准备使用 `scripts/prepare-release.sh <target> <sha> <physical-node>`。自动封板和手动准备都不得自动切生产。
5. `legacy-*-recovery-aliyun.yml` 只用于明确恢复；普通部署入口不会调用它们。
6. 所有入口固定从 `zdt-next` 触发。历史分支中的旧工作流仅是 Git 历史，不是可执行入口。
7. 当前工作流不上传 GitHub Actions 依赖缓存。自托管 Runner 的本地 npm 缓存自然复用，避免生产切换后因缓存上传卡住队列；这是一项可调整配置，不是门禁。
8. 逻辑节点若由另一物理节点托管，1.4.3 必须拒绝请求并要求填写真实物理节点；不得让 `L1` 名称掩盖 `L0` 落点。

## 容量边界

当前 ECS 为 4 vCPU、约 8 GiB 内存。两个 Build 服务共享 `zdt-build.slice`，合计上限为 3.5 CPU、6.8 GiB；重型冷构建还必须持有 `/run/lock/zdt-build` 主机锁。Release 不进入该 slice，始终保持独立单并发，备用 Release 保持停止且禁用。
