# GitHub Actions Runner（1.3.2 阿里云版）

发布与构建只使用北京 ECS 上的原生 Linux Runner，不再在 Mac 或 Docker 中运行 Runner，也不再申请 GitHub 托管的 `ubuntu-latest`。

## 固定拓扑

- 构建 Runner：标签 `self-hosted, linux, x64, zdt-aliyun-build`，只执行质量检查与 Prepare。
- 发布 Runner：标签 `self-hosted, linux, x64, zdt-aliyun-release`，只执行候选封板、基线登记和生产切换。
- 备用 Runner：平时禁用；只有现役 Runner 故障时人工启用，不能与现役发布 Runner 同时消费 `zdt-aliyun-release`。
- 同一物理目标由 GitHub concurrency 和远端目标锁共同串行化；增加 Runner 数量不能绕过目标锁。

两个现役 Runner 均以系统服务常驻。Runner 注册令牌只在安装时短暂使用，不写入仓库、工作流、日志或长期配置。访问 GitHub 的特殊线路由 ECS 本机网络层管理；阿里云 OSS、ECS 内网和生产业务流量保持直连。

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
