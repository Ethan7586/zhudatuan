# AU-006 分支与状态记录

- 固定远程基线分支：origin/zdt-next。
- 固定基线完整 SHA：5a1ce71eebbefaa826368a9e1dc17730f9363bc4。
- 审计分支：codex/full-codebase-audit-20260913。
- AU-006 开工检查点：CP-05，共享状态基础设施审计完成（e3ca3a04e5faaf160db2a3d8e38a875fd8a69112）。
- 2026-09-14 观察到 origin/zdt-next 已前进到 768ff86f22f0d28da69ef51a572706054fc4163d；按协议不 merge、不 rebase、不改变本次基线。
- 本 AU 只写 full-codebase-audit-20260913 目录。未修改源码、测试、配置、workflow、迁移、依赖、锁文件或生成物。
- 未推送、未合并、未部署、未改变线上资源。

状态标签：

- [FACT] config 包 39 个文件均按基线 blob 建档；35 个人工 TS 文件已深入审阅。
- [ENVIRONMENT BLOCKED] 正式测试缺 vitest；正式环境门禁缺 typescript。
- [UNKNOWN] 线上 environment、console-runtime.json 和节点 Manifest 当前值未读取。
- [STOP] CP-06 提交后停止，等待 Ethan 授权 AU-007。
