# AI 直达部署

生产部署只有一条有效路径：GitHub `Deploy` 工作流直达阿里云。

## 用户入口

Ethan 在当前任务中输入“部署”即为生产授权。AI 不得再次索要确认，也不得把测试、类型检查、候选、审批或验收插入部署路径。

“部署”只允许执行现有提交的发布，不允许顺手修代码、改测试或文档、清理权限、处理其他项目或扩大范围。若构建、传输或重启失败，立即停止并只报告失败点；后续修复必须等待 Ethan 明确输入“修复部署”。

本地触发入口：

```bash
scripts/deploy-now.sh [target] [commit] [node]
```

- `target` 留空：在一个 Job 内部署该提交影响的全部运行目标。
- `commit` 留空：使用 GitHub `zdt-next` 的精确 HEAD。
- `node` 留空：使用 `hbbtzn-l1`。

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
