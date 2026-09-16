# AU-485｜Experience version resource scope

- 主审 `20260821079000_resolve_experience_version_scope.sql`（109 行），并人工反查 Experience version operation、application/version 数据关系、OperationController 与后续 scope resolver 演进；未执行迁移、数据库查询或线上验证。
- 迁移在 `access.resource_scope` 中增加 `experience.version → experience.application.scope_id` 的反查，并以既有 Owner membership 和第一条 version fixture 断言 validate operation 的 resolved scope 与 owning application 一致。
- Experience validate/publish/restore 以 version ID 作为资源。OperationController 的授权阶段先调用 resource resolver，再把 access context 交给 handler；因此该分支使 immutable version 继承 application 的权威组织边界，而不是把版本 ID 当成可授权的独立 scope。
- **G0**：version command 的范围授权依赖此 resolver 演进。归并至 **GX-0030**（动态身份/授权 scope resolver）：禁止删除、改写、跳过或单独重放；需独立复核当前 function body、未知 version fail-closed、跨 application 反事实及恢复流程。未发现新增 P0–P3；未验证真实 fixture、RLS 或线上版本发布。
