# GitHub Actions Runner（1.3.2 阿里云版）

Prepare 当前默认使用 GitHub 标准托管 `ubuntu-24.04`；可显式选择北京 ECS 上的原生 Linux Build Runner。候选封板及生产切换仍由阿里云 Release Runner 执行。

## Build Runner 选择

通过现有系统入口选择本次构建使用的 Runner，不改变后续默认值：

```bash
ZDT_PREPARE_RUNNER=aliyun /Users/Ethan/.codex/bin/zdt-delivery prepare <target> <full-source-sha> <physical-node>
```

省略 `ZDT_PREPARE_RUNNER` 时使用 GitHub；GitHub 页面手工触发 Prepare 时也默认 `build_runner=github`。两种构建使用同一份工作流、Node 22.22.0、npm 10.9.4、双冷构建及运行证据，并写入现有 OSS 制品路径；GitHub 构建不配置生产 SSH。Build 失败后停止，不自动切换线路、封板或部署；Seal、候选验证、Release、Deploy 和生产 SSH 始终只走阿里云 Release Runner。

## 固定拓扑

- 构建 Runner：标签 `self-hosted, linux, x64, zdt-aliyun-build`，只执行质量检查与 Prepare。
- 发布 Runner：标签 `self-hosted, linux, x64, zdt-aliyun-release`，只执行候选封板、基线登记和生产切换。
- 发布冷备用：同样位于 staging ECS，只备份发布角色；完成注册后保持停止且禁用。通过 `switch-release-runner.sh standby` 切换时会先停止主发布 Runner，避免两个发布进程同时消费 `zdt-aliyun-release`。
- 同一物理目标由 GitHub concurrency 和远端目标锁共同串行化；增加 Runner 数量不能绕过目标锁。

两个现役 Runner 均以系统服务常驻。Runner 注册令牌只在安装时短暂使用，不写入仓库、工作流、日志或长期配置。访问 GitHub 的特殊线路由 ECS 本机网络层管理；阿里云 OSS、ECS 内网和生产业务流量保持直连。

第三批固定为“2 个现役 + 1 个冷备用”：

- `aliyun-staging-zdt-build`：常驻构建，目录 `/opt/actions-runner-build`。
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

1. 默认分支 `zdt-next` 当前使用文件名带 `-aliyun` 的工作流入口；新分支从默认分支创建后自动继承。
2. 正式部署只允许 `scripts/deploy-now.sh <target> <sha> <physical-node>`，它调用已经封板的 1.3.2 制品。
3. 制品准备与候选封板只允许 `scripts/prepare-release.sh <target> <sha> <physical-node>`，完成后必须停止，不得自动切生产。
4. `legacy-*-recovery-aliyun.yml` 只用于明确恢复；普通部署入口不会调用它们。
5. 所有入口固定从 `zdt-next` 触发。历史分支中的旧工作流仅是 Git 历史，不是可执行入口。
6. 当前工作流不上传 GitHub Actions 依赖缓存。自托管 Runner 的本地 npm 缓存自然复用，避免生产切换后因缓存上传卡住队列；这是一项可调整配置，不是门禁。
7. 逻辑节点若由另一物理节点托管，1.3.2 必须拒绝请求并要求填写真实物理节点；不得让 `L1` 名称掩盖 `L0` 落点。

## 容量边界

当前 ECS 为 4 vCPU、约 8 GiB 内存。推荐同时运行一个构建任务和一个发布任务；多个构建任务继续排队。发布任务始终单并发。只有迁移到更大机器或独立构建节点后，才增加活跃构建 Runner。
