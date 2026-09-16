# AU-883｜296 条需求修改点审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`福利商城296条需求修改点.md`，1 个文件、319 行。
- 方法：主样本审阅元数据、分层索引、状态语义和来源关系；核对权威工作簿哈希、`requirements/mapping.json`、requirement generator 与 `check:requirementgraph`。不逐条重复审阅 296 项已由 machine-readable mapping 覆盖的业务需求。

## 结论

文档正确表达“Implemented 不等于 Accepted/Released”和未勾选不代表需求已完成；但它自称从 mapping 展开并声明源工作簿哈希 `6f5a…`。当前权威工作簿实际 SHA-256 为 `78cfc3…`，`requirements/mapping.json` 也使用 `78cfc3…`，且 requirement generator 只生成 mapping/YAML 契约，不生成本 Markdown。正式 `check:requirementgraph` 消费 machine-readable mapping/YAML/contract，不消费该索引。

因此该索引不能作为当前 296 项需求、操作/路由映射或状态的权威证据，记录 F-0341（P3）并归 DC-0125（G1）。在需求 Owner 确认是否需要从当前 mapping 受控重生前，不删除、不改勾选、不把旧映射当实现/发布依据。

未运行 requirement generator、质量门、测试、构建、部署、数据库或外部控制面操作，未修改业务代码、配置、测试、工作流、迁移或运行资源。
