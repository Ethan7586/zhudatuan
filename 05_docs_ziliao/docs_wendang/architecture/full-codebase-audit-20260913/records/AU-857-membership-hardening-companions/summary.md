# AU-857｜会员权限 Hardening 陪同材料审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`membership-permissions/hardening/` 的 context、Markdown 结论/提案与四张 Mermaid 方案图，共 7 个文件、265 行；同目录 `hardening.json` 已在 AU-833 审阅。
- 方法：context、结论与提案深入审阅；四张同一套 before/options/after 图逐图核验语义和与正文的对应关系。与 AU-833 的 revision、source drift、消费者搜索结论对照。

## 结论

七份材料共同记录旧 `smart-wing-membership-permissions` revision `2b39175` 的层级 Scope hardening 推理：不让浏览器构造祖先路径，维持 tenant 隔离，采用兼容的组织闭包与 dual-read 回滚，而不立即替换旧字段。四张图分别说明旧 flat scope、兼容闭包、继续扩展 flat scope 与立即替换三种模型，属于同一提案的必要设计对照。

与 AU-833 的 `hardening.json` 相同，路径和 revision 已不再对应当前代码布局，未找到当前 runtime、workflow 或代码消费者。它们不是现行策略或配置，也不能因零引用删除；七份文件均列为 G1，等待身份/安全负责人决定是否正式归档。未新增 P0–P3。

本单元未运行测试、构建、数据库、部署或外部控制面操作，未修改业务代码、配置、测试、工作流或运行资源。
