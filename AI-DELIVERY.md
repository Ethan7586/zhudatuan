# AI 直达部署（部署纯洁性契约 1.1）

生产部署只有一条有效路径：GitHub `Deploy` 工作流直达阿里云。

## 用户入口

Ethan 在当前任务中输入“部署”即为生产授权。AI 只使用已经存在、已经登记且无需修改代码或云资源即可触发的部署通道，不得再次索要确认，也不得把测试、类型检查、候选、审批或验收插入部署路径。

“部署”只允许执行现有提交的发布，不允许顺手修代码、改测试或文档、清理权限、处理其他项目或扩大范围。若构建、传输或重启失败，立即停止并只报告失败点；后续修复必须等待 Ethan 明确输入“修复部署”。

一次部署只处理上下文已经明确的一个目标。目标不明确时只询问目标；不得默认部署全部受影响目标。只有 Ethan 明确指定多个目标时才能扩大到指定范围。

## 通道与部署严格分离

- 目标没有现成通道时，本次部署立即停止，只报告“通道尚未建立”，并单独询问是否建立。
- 不得以“部署”为由创建或修改 GitHub 工作流、发布脚本、制品路径、SSH、ECS、数据库或其他基础设施。
- 只有 Ethan 明确输入“建立 <目标> 部署通道”才允许建设通道。
- 通道建设完成后立即停止，不得顺带执行第一次部署；必须等待新的“部署”口令。
- 部署运行期间收到的非部署请求排队到部署结束后单独处理，不得混入当前运行。
- 部署耗时只计算 GitHub Deploy 工作流从触发到成功或失败终态的时间；建设和修复时间必须单独报告。

本地触发入口：

```bash
scripts/deploy-now.sh [target] [commit] [node]
```

- `target` 应使用上下文中已经明确且已经具有现成通道的单一目标；只有 Ethan 明确指定全部受影响目标时才可留空。
- `commit` 留空：使用 GitHub `zdt-next` 的精确 HEAD。
- `node` 留空：使用 `hbbtzn-l1`。

H6 阿里云 CDN 使用同一个 GitHub `Deploy` 工作流，登记目标为 `h6-cdn`。它不重新构建
Storefront 制品，只在确认阿里云 CDN、HTTPS、直连源站和预切流探测均正常后，把 H6 的
Cloudflare DNS 从 Tunnel 回滚点切换到阿里云 CDN CNAME。状态、通道建立意图和回滚统一通过：

```bash
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action status
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action establish
npm run release -- channel --target h6-cdn --node hbbtzn-l1 --action rollback
```

建立通道不得执行 `--action deploy`；首次切流仍须等待新的“部署 H6”口令。

## 唯一执行链

```text
精确 Git SHA
  -> GitHub Deploy（单 Job）
  -> 只运行生产构建
  -> 上传阿里云不可变版本目录
  -> 记录 previous
  -> 原子切换 current
  -> 重启目标服务
```

`h6-cdn` 是边缘路由目标，其唯一执行链为：精确 Git SHA → GitHub `Deploy` 单 Job →
直连源站与 CDN CNAME 探测 → Cloudflare DNS 原子切换。它不改运行制品指针、不重启业务服务。

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

## E06 一次性 staging 验收

E06 的三个 Sovereign 验收节点只通过统一发布入口建立和操作：

```bash
npm run release -- accept-e06 --from <artifact-A-ref> --to <artifact-B-ref>
```

该命令只创建三个一次性 Docker staging 节点，使用正式制品清单和发布代理语义对 S-B 执行
`A→B→A`，采集指针、进程、健康、配置、数据与四流历史证据后销毁节点。它不触发 GitHub
Deploy，不连接生产主机，不修改生产指针、正式域名或生产数据，也不调用支付渠道。
