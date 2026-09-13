# AU-006 历史取证

历史只用于解释当前结构，不代替固定基线代码事实。

## 关键演进

- 2026-09-04 fe3269c8：四个专用 Environment 测试已进入仓库；固定基线 package test 脚本仍未列入。
- 2026-09-07 b797d7ed、c976803f：SFL 节点内核建立并生产硬化。
- 2026-09-08 f8154da8、ee0a6a1f：Console 双节点同源制品与 L1 独立运行接入。
- 2026-09-09 a4b0867e：AutoNode 节点生成收口。
- 2026-09-10 9d945bb8：L0/L1 域名与边缘关系调整。
- 2026-09-11 1d725f2f、5c082b37、68658913：节点关系、Hosted 生成与服务端 NodeContext 快速扩展。
- 2026-09-12 143506f5、98dc2686、b82b9e46、e3157cb8：管理员 Scope、Hosted 主权与商品域继续修改；config package test 脚本同期有变更但仍遗漏四文件。

## 审计含义

- SflNodeKernel.ts 为 1,909 行高变更密度权威内核，不能按文件名或测试绿灯作浅审；本 AU 已逐段覆盖并对 Host、digest、relation、freeze 与 Console 投影反追。
- environment.mjs 的静态所有权模型早于多个前端和 Catalog Jobs 当前读取方式；当前冲突应按代码事实记录，不能猜测某一方自然废弃。
- 四个遗漏测试并非刚生成的孤儿文件，历史跨多个后续 package 变更仍存在，因此记录为正式入口覆盖缺口，而不是删除候选。
