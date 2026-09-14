# AU-481｜平台 Owner 控制台只读操作授予

- 主审 `20260821074000_grant_platform_owner_operations.sql`（115 行），并人工反查 capability membership resolver、AccessPipeline、后续 Owner 权限演进与相关 Console operation/module；未执行迁移、数据库查询或线上验证。
- 迁移针对明确的 12 项控制台 read permission，先移除同 permission 的 deny，再为 `role-platform-owner-v2` 建立 allow；没有把 write/manage permission 一并扩大。随后它对该 Owner membership 的实际 `capability.membership_operations` 断言 12 个 operation 全可用。
- AccessPipeline 在 handler 前从 membership capability 集判断 operation；缺失会拒绝。因此此 migration 修复的是“契约/模块存在但 Owner 无法进入控制台工作区”的权限链断点，而非 UI 显隐问题。各业务写操作仍有独立 permission、scope 和 handler 校验。
- **G0**：平台 Owner 只读控制台能力依赖这些精确 allow/deny 映射。**GX-0037**：平台 Owner 控制台权限修复迁移，禁止删除、改写、跳过或单独重放；需独立复核当前 permission 集、deny 优先级、role assignment 和每项 operation 的资源范围。未发现新增 P0–P3；未验证真实 Owner membership、Console release target 或线上权限回归。
