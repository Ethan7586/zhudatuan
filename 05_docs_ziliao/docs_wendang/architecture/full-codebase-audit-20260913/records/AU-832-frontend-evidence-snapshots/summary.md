# AU-832｜前端历史 evidence 快照

- 覆盖范围：frontend baseline/execution/gaps 三份 YAML（786 行）及 files.json generator 的只读 check。
- 新发现：**F-0322/P2**。YAML 固定在 2026-08-26 外部 integration 分支，包含当前不存在的目录和历史 P0/VerifiedLocal 标签；它们没有代码消费者。files.json 是生成制品，当前 `--check` 仍报 drift（与既有 F-0005 一致）。
- 裁定：历史 P0 标签不是当前线上 P0 证据；必须以当前基线的代码、路由、运行配置和独立复核重新确认。未写 files.json，未运行任何前端服务或构建。
