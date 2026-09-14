# AU-477｜授权决策审计范围修复

- 主审 `20260821070000_repair_decision_audit_scope.sql`（16 行），并人工反查 `access.decisionaudit` 定义、PgDecisionSink、WebRiskCheckAdapter、运行单元权限和后续专用 RLS policy；未执行迁移、数据库查询或线上验证。
- 迁移替换 shopapp 的 `appscope` policy：scope 为空的决策仅允许当前 actor 读写；带 scope 的决策须通过 `access.scope_allowed`。断言确保 policy 存在，避免静默缺失。
- PgDecisionSink 在数据库事务中设置 server-derived tenant/membership/scope/actor/trace 后写入该表；WebRiskCheckAdapter 以 actor、operation、scope 集和时间窗口读取它计算 velocity 风险。因此该表不只是审计展示，还是授权风险决策的输入。
- 后续 console、web-business、purchase、provisioning 等专用角色均另设更窄的 policy/权限，说明此处 shopapp policy 是通用基线而不是完整的最终部署授权面。
- **G0**：actor/self 和 scope 隔离是决策记录及风险速度计算的必要数据边界。**GX-0033**：授权决策 RLS 修复迁移，禁止删除、改写、跳过或单独重放；需独立复核角色 grant、RLS 联合语义、actor-less 决策和风险读取反事实。未发现新增 P0–P3；未验证真实 database policy、shopapp 表级 privileges 或线上决策日志。
