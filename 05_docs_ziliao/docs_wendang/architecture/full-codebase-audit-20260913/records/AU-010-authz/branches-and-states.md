# AU-010 分支与状态记录

## 1. Git 状态

| 时点 | 分支 | HEAD | 固定基线 | `origin/zdt-next` 只读观察 | 工作区 |
| --- | --- | --- | --- | --- | --- |
| 开工 | `codex/full-codebase-audit-20260913` | `e000e3a9036d4628f25017b591848489c7754045` | `5a1ce71eebbefaa826368a9e1dc17730f9363bc4` | `76da55adaebc7a35e8257d42c83c5f38bba48f5b` | clean |
| 提交闸门前 | 同上 | CP-09 + AU-010 报告差异 | 同上 | `0c5d6c8fced982b9b69702fcb954332295ae0c93` | 只包含审计目录报告差异 |

[FACT][E-AU-010-001] 固定基线仍是审计分支祖先；AU-010 没有 merge/rebase/cherry-pick 主线，没有 push、deploy 或线上写入。开工时远程分支 37 条；本单元未创建或删除分支。收口观察到 `origin/zdt-next` 已继续前进，但按协议没有改变固定审计基线。

## 2. Authz 判定状态

| 阶段 | 条件 | 当前结果 | 下一阶段/终点 |
| --- | --- | --- | --- |
| precheck | membership inactive | `MEMBERSHIP_INACTIVE` | deny |
| precheck | accessVersion 不同 | `ACCESS_VERSION_STALE` | deny |
| precheck | permission 在 denies | `EXPLICIT_DENY` | deny |
| precheck | permission 未定义 | 抛 `PERMISSION_UNKNOWN` | AccessPipeline 记录 deny 后传播 |
| precheck | 没有当前有效 allow grant | `PERMISSION_MISSING` | deny |
| scope | resource kind 不在 permission.scopes | `SCOPE_KIND_DENIED` | deny |
| scope | 无 containment grant | `SCOPE_DENIED` | deny |
| assurance | critical 且 step-up 缺失/过旧/未来 | `STEPUP_REQUIRED` | challenge |
| complete | 全部通过 | evidence | AccessPipeline 继续 capability/risk/proof |

## 3. Scope containment 状态

| grant | resource/条件 | 当前实现 | 结论 |
| --- | --- | --- | --- |
| platform | 任意 kind/id/tenant/path | 立即 true | [BROKEN] 不验证 canonical platform 或 path |
| self/owner | kind 与 id 都相同 | true | 正常精确边界 |
| self/owner | kind 或 id 不同 | false | 正常 |
| 其它 kind | grant.tenant 存在但 resource.tenant 不同/缺失 | false | 正常拒绝 |
| 其它 kind | grant.tenant 缺失 | 跳过 tenant 比较 | [BROKEN] 异常输入可能跨 tenant |
| 其它 kind | grant.id == resource.id | true，不比较 kind | [BROKEN] 异常输入可跨 kind 同 ID |
| 其它 kind | resource.path 有同 kind/id ancestor | true | 正常 canonical 层级路径 |

## 4. 角色到判定的状态

| 步骤 | 当前执行点 | 权限事实 |
| --- | --- | --- |
| 创建/编辑 custom role | Console RoleEditor → `access.roles.manage` → AccessOperations | UI 给 role manager 展示全部 184 permissions；服务端不校验 actor permission subset 或 owner-only code |
| 分配角色 | `manageRoleAssignment` | 内建 senior role 按 ID 要求 Owner；自定义角色不按 permission 内容识别同等特权 |
| 二级范围权限 | `checkScope(... access.scope.manage ...)` | 只检查 allow/effective/containment，未执行该 permission 的 explicit deny precheck |
| 数据投影 | `access.resolve_session_membership` | 有效 role/override 形成 denies；允许 permission 投影到有效 scopegrant |
| 请求授权 | AccessPipeline | 当前 Operation permission 走完整 precheck；二级 permission 是否完整检查取决于 caller |
