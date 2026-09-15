# RV-0048｜Membership 权威函数 schema 重绑独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0026
- 结论：**维持 GX；未发现 P0。**

迁移先要求五个权威函数的定义仍含 `member.membership`，再以原函数定义重建到 `access.membership`；提交前扫描 identity/access/capability 全部函数，任何旧引用即 fail-closed，并验证 storefront membership resolver。当前安全解析器仍使用 session membership、access version、scope 和 capability 函数。它是表所有权迁移的必要顺序节点，不能删除、改写或单独重放；生产函数权限、真实会话与恢复未验证。
