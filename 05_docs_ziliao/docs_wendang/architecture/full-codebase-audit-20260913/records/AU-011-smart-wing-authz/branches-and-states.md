# AU-011 分支与状态记录

## Git与发布状态

| 时点 | 审计分支 | HEAD | 固定基线 | 工作区 |
| --- | --- | --- | --- | --- |
| 开工 | `codex/full-codebase-audit-20260913` | CP-10 `2555fbacc832731070d6e20f4938ad3c6525c247` | `5a1ce71eebbefaa826368a9e1dc17730f9363bc4` | clean |
| 提交闸门前 | 同上 | CP-10 + AU-011报告差异 | 同上 | 仅允许审计目录 |

`@smart-wing/authz`没有独立进程。唯一直接源码caller属于兼容Commerce API；当前仓库禁止旧admin制品进入发布，Storefront Worker只复用public router。审计没有把“无当前发布入口”升级为删除结论。

## 判定状态

| 顺序 | 条件 | 结果 |
| ---: | --- | --- |
| 1 | membership非active、到期或非法expiry | `MEMBERSHIP_INACTIVE` |
| 2 | permission在deniedPermissions | `PERMISSION_DENIED` |
| 3 | permission不在permissions | `PERMISSION_MISSING` |
| 4 | tenant不同且没有匹配的platform/distributor binding | `TENANT_MISMATCH` |
| 5 | critical且step-up缺失/过旧/未来 | `STEP_UP_REQUIRED` |
| 6 | 没有Scope binding | `SCOPE_MISMATCH` |
| 7 | 全部通过 | `ALLOWED`并返回Membership/role/permission/scope evidence |

F-0062位于步骤5和6：错误Scope的critical请求先收到challenge，而不是直接scope拒绝。
