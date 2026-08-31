# 主打团权限系统未完成任务交接报告

- 报告日期：2026-08-30（Asia/Shanghai）
- 用途：交给新的 Codex 任务继续实现、验证与部署
- 唯一代码范围：`/Users/Ethan/Desktop/Projects/zhudatuan/main`
- 事实原则：代码、Git 与本轮命令输出优先；外部控制台状态单独标记，不把口头状态当作部署证据

## 1. 结论

当前权限系统已经有一个可运行的本地候选切片：Root Owner 创建管理员邀请码、受邀者同时建立 storefront/operator Membership、初始 operator 角色无业务权限，以及 Root 对非 Owner 身份执行“保留历史、释放登录手机号”的注册重置。相关局部测试通过。

但完整权限系统尚不能部署为公网可验收版本，主要原因是：

1. 授权引擎仍有 tenant fail-open 与 platform 全放行。
2. `access.role` 尚无 tier，角色管理也没有“只能向下授权、不能授予自己没有的权限”的服务端约束。
3. Owner 两阶段转让、冷静期、撤销、动态 Owner context 均未进入当前权威 Operation／migration。
4. Owner 保护 trigger 已有候选实现，但合法转让通道缺失；两者不能拆开部署。
5. `shopjob` 仍持有 identity/access/member 等安全表的宽泛 raw DML，能够破坏认证边界。
6. 当前工作区严重脏且落后远端，尚无可部署的单一 clean SHA。
7. 隔离服务器只有配置骨架，没有真实 RDS、Tair、KMS、Secret、短信和公网 E2E 证据。

建议口径：

| 范围 | 当前完成度 | 说明 |
|---|---:|---|
| 需求与权限边界规范 | 约 85% | 个人身份、实体权限、三级管理与 Root/Tenant Owner 方向已写清 |
| Root 邀请／双 Membership／0 权限切片 | 约 65% | 本地代码和局部测试存在；缺真 PostgreSQL、浏览器与公网短信闭环 |
| 身份重置后重新邀请 | 约 65% | 本地实现与局部测试存在；不得表述为物理删除会员 |
| 分级授权与多租户边界 | 约 20% | 规范存在，tier 数据模型和授权断言未实现 |
| Owner 转让 | 约 5% | 只有规范与保护候选，没有合法转让流程 |
| 公网 staging 可验收性 | 约 10% | 有静态部署骨架，无运行证据与公网地址 |
| **完整权限系统综合** | **约 40%** | 可继续开发，不可切正式流量 |

## 2. 已确认的业务模型

### 2.1 身份与实体权限分离

```text
Principal/Profile/Credential/Session
└─ 只描述自然人、登录凭证和本人安全信息

Membership
├─ Role：可以执行什么动作
└─ Scope Grant：可以操作哪些实体
```

- 管理角色不得挂到 Principal、Profile 或手机号上。
- 同一自然人可以同时拥有 storefront 与 operator Membership。
- 商品、店铺、集团、平台等实体权限必须通过 Membership 的 Role＋Scope 表达。
- 手机号只是登录身份，不是角色、租户或权限主键。

### 2.2 管理位阶

规范预留：

| 位阶 | tier | 语义 |
|---|---:|---|
| Tenant Owner | 1000 | 每个有效租户唯一，可转让 |
| Senior Admin | 500 | 可邀请、可向下授权 |
| Admin | 100 | 受邀后初始业务权限为空 |
| Reserved | 0 | 不作为可授予管理位阶 |

主打团 Root Owner 属于控制平面，位于各平台商 Tenant Owner 之上，但不应自动获得租户订单、财务等业务操作权。Root 对 Tenant Owner 的停用或强制撤换应使用独立 governance Operation，并保留 Step-Up、原因、审计和恢复路径。

### 2.3 邀请与注册

- 管理员邀请码不能选择角色，固定生成“待授权管理员”。
- 邀请码与短信 OTP 是两个不同凭据。
- 受邀注册原子创建 storefront 与 operator 两个 Membership。
- operator 初始角色必须是零业务 Permission。
- 物理删除会员不是重邀前提；应撤销认证身份并释放登录 subject，同时保留订单、财务和审计引用。

权威规格：

- `docs/membership-permissions/06-TIERED-MULTITENANT-OWNER-INVITATION-SPEC.md`
- `docs/membership-permissions/07-OWNER-IDENTITY-RESET-SPEC.md`

## 3. Git 与工作区状态

本报告生成时：

```text
HEAD        01f1ed49dd5df67d28956a116de066f5fa1d5668
origin/main f0ef128f4027ad35ce9ccedf5923940eb4672c98
divergence  local ahead 0 / behind 28
working tree tracked modified 179 / untracked 157
```

权限相关改动与大量财务、设计、Provider、构建改动混在同一工作区。尤其以下文件不是干净基线：

- `services/commerce/src/modules/identity/IdentityOperations.ts`
- `services/commerce/src/modules/access/AccessOperations.ts`
- `packages/authz/src/PermissionCatalog.ts`
- `apps/console/src/feature/member/MemberRoute.tsx`
- `apps/console/src/feature/access/AccessRoute.tsx`
- `database/contracts/*`
- `packages/contract/*`

新任务开始时禁止直接执行 `git reset --hard`、`git clean`、覆盖式 checkout 或在未保存现有改动时 `git pull`。第一项工作必须是按文件和 diff hunk 区分：远端 28 个提交、当前权限候选、其他用户改动，并形成可恢复的权限切片提交。

## 4. 当前已有实现

### 4.1 管理员邀请码与双 Membership

候选迁移：

- `database/supabase/migrations/20260829100000_tiered_admin_invitation_foundation.sql`
- `database/supabase/migrations/20260829101000_reconcile_tiered_invitation_contract.sql`
- `database/supabase/migrations/20260829102000_resolve_tiered_invitation_tenant_scope.sql`

当前行为：

- 为每个现有 tenant 建立 `role-console-pending-v1:<tenant>`。
- pending role 不含任何 RolePermission。
- 管理员邀请固定 `target_client='operator'`，同时记录 storefront `role:self`。
- 当前 `identity.invitation.manage` 仅赋予 `role-platform-owner-v2`；Senior Admin 尚未开放。
- 注册时以同一事务创建 storefront 与 operator Membership。
- 邀请码明文只在创建响应出现一次，审计结果会将 `code` 重写为 `[REDACTED]`。

应用入口：

- `services/commerce/src/modules/identity/IdentityOperations.ts`
- `services/commerce/src/modules/access/AccessPort.ts`
- `apps/console/src/feature/member/MemberInvitationCommand.ts`
- `apps/console/src/feature/member/MemberInvitationDialog.tsx`
- `apps/console/src/feature/member/MemberRoute.tsx`

### 4.2 身份重置与手机号重新邀请

候选迁移：

- `database/supabase/migrations/20260829200000_owner_identity_reset_foundation.sql`
- `database/supabase/migrations/20260829201000_reconcile_current_contract_checksum.sql`

当前行为：

- Operation：`identity.members.reset`
- Permission：`identity.registration.reset`
- 仅 `role-platform-owner-v2` 获得该 Permission。
- 不物理删除 Principal、Profile、Membership、订单或审计主键。
- 撤销 Session、Assurance、Challenge、Credential 等认证状态。
- 原登录 subject 改为不可关联 tombstone，从而释放手机号唯一键。
- Root 不可重置自己或其他 Root Owner。
- Console 要求 capability、permission、CSRF、row eligibility，并先执行 Owner 密码再验证。

应用入口：

- `services/commerce/src/modules/identity/IdentityOperations.ts`
- `apps/console/src/feature/member/MemberRegistrationResetCommand.ts`
- `apps/console/src/feature/member/MemberRegistrationResetDialog.tsx`

### 4.3 合同与本地部署骨架

- `packages/contract/definitions/operations.yml` 已包含 `identity.members.reset`。
- SDK 已生成 `identity.invitations.create/revoke` 与 `identity.members.reset`。
- `infrastructure/zhudatuan/aliyun/staging/` 包含 Caddy、PM2、环境变量示例、delivery 合同与静态检查。
- 该目录只是配置骨架，不是已部署证据。

## 5. 本轮独立验证证据

以下命令均在 `main/` 执行：

| 命令 | 结果 |
|---|---|
| `npm test -w @shop/authz` | 1 file，4/4 tests 通过 |
| `npm run typecheck -w @shop/authz` | 通过 |
| `npm test -w @shop/commerce -- src/modules/identity/IdentityOperations.test.ts src/modules/identity/IdentityRegistration.test.ts src/modules/identity/IdentityReset.test.ts src/modules/identity/IdentitySecurity.test.ts` | 4 files，8/8 tests 通过 |
| `npm run typecheck -w @shop/commerce` | 通过 |
| `npm test -w @shop/console -- src/feature/member/MemberInvitationCommand.test.ts src/feature/member/MemberRegistrationResetCommand.test.ts src/feature/member/MemberRoute.test.tsx` | 3 files，17/17 tests 通过 |
| `npm run typecheck -w @shop/console` | 通过 |
| `npm run check:migrations` | inventory `historical=94 repair=85 total=179`；PGlite schema replay 通过 |
| `npm run test:environment-bootstrap` | PGlite 179 migration replay 通过 |
| `node infrastructure/zhudatuan/aliyun/staging/check.mjs` | 通过 |
| scoped `git diff --check` | 通过 |

限制：

- Authz 的 4 个现有测试没有覆盖 tenant 缺失、resource tenant 缺失、错误 platform root 等关键反例，因此“4/4”不能证明多租户安全。
- Identity 与 Console 测试主要是 harness／组件边界，不是真 PostgreSQL、真实 Session、真实短信或浏览器 E2E。
- `npm run check:generated` 失败，原因是仓库缺少 `apps/miniapp/miniprogram/styles/tokens.wxss`。该问题不是权限逻辑失败，但会阻塞全仓生成物门禁。

尚未取得：

- 真 PostgreSQL 16 全量 179 migration replay。
- `shopapp`／`shopjob` 真 ACL 负向证明。
- Owner 登录到邀请码、短信 OTP、注册、Console 登录、0 权限的浏览器 E2E。
- 隔离公网域名、TLS、RDS、Tair、KMS、Secret Store 与阿里云短信回执。

## 6. 必须先处理的安全阻断

### P0-1：Authz tenant fail-open

`packages/authz/src/Policy.ts` 当前逻辑：

```ts
if (grant.kind === 'platform') return true;
if (grant.tenant !== undefined && resource.tenant !== grant.tenant) return false;
```

问题：

- 任意 platform grant 无条件包含所有 resource。
- grant 未带 tenant 时会跳过 tenant 边界。

完成标准：

- self／owner 仅精确 ID。
- 非 platform 层级 grant 与 resource 两侧 tenant 必须都存在且相等。
- platform 只能命中精确 resource 或 canonical ancestor path。
- 增加 tenant 两侧缺失、跨 tenant、错误 platform、canonical platform root、不同 self／owner 的正负测试。

### P0-2：角色管理尚未实现 tier 与权限子集

`services/commerce/src/modules/access/AccessOperations.ts` 的 `access.roles.manage` 当前可直接按请求中的 permission codes 重建 RolePermission，没有以下服务端断言：

```text
target effective tier < actor effective tier
target role tier < actor effective tier
target permissions subset of actor effective permissions
actor scope contains target scope
actor tenant = target tenant = role tenant
```

`access.scopes.manage` 也没有显式的目标成员 tier 与 tenant 等值检查。现有实现不能称为分级授权系统。

### P0-3：Owner 保护与转让未成对实现

`20260829200000_owner_identity_reset_foundation.sql` 增加了 5 个 Root Owner 保护 trigger，但当前没有：

- Owner transfer Operation。
- 发起／接受／撤销状态机。
- 24–72 小时冷静期。
- 合法、窄权限的 trigger bypass／SECURITY DEFINER 切换函数。
- 新旧 Owner 动态 context。
- transfer 后旧 Owner 降级、Session 失效和唯一 active Owner 断言。

因此不得单独部署 Owner 保护 migration 后再“以后补转让”。

### P0-4：`shopjob` 仍可 raw DML 安全表

`database/supabase/migrations/20260821030000_revoke_public_access.sql` 仍向 `shopjob` 授予 identity、access、member 等 schema 的全表 `select,insert,update,delete`，并建立 `using(true) with check(true)` 的 job policy。当前后续 migration 仅见对个别表的撤销，没有收紧整个认证边界。

完成标准：

- 撤销 `shopjob` 对 Session、Credential、Assurance、Membership、RoleAssignment 等安全表的 raw DML。
- Jobs／import／retention 只通过窄 SECURITY DEFINER 函数执行必要动作。
- 真 PostgreSQL 负向证明：无法伪造 chosen-token Session 或 AAL3 Assurance。
- 保留 unrelated job/import 的正向回归。

### P0-5：空 staging 的 Owner bootstrap 未闭合

当前可见的 `20260817191000_bootstrap_ethan_platform_owner.sql` 依赖既有 legacy `ethan` 身份、既有 platform owner scope 与 public schema 数据；仓库中未见可用于空 canonical staging 的独立 Owner bootstrap 工具。

新 bootstrap 必须：

- 只在 owner singleton 为 `bootstrap_pending` 时读取一次性 Secret。
- active 时动态读取并严格验证当前唯一 Owner，不能永久依赖固定 Ethan Secret。
- transfer 后重启不得恢复旧 Owner，也不得因旧 Secret 被撤销而失败。
- API／Console 在唯一 active Owner 建立前保持 not-ready。
- 日志和 summary 不输出手机号、密码、邀请码或 Secret。

## 7. 分级权限与 Owner 转让剩余实现

按以下顺序继续，不能先做 UI：

1. 修复 Authz fail-closed，并补齐关键反例。
2. 收紧 `shopjob` 认证／授权表 ACL，并跑真 PostgreSQL 正负验证。
3. 为 `access.role` 增加 tenant-aware tier，盘点并回填现有角色。
4. 在 `access.roles.manage` 与 `access.scopes.manage` 实现向下授权、权限子集、tenant 与 scope containment。
5. 分离 `role-platform-owner-v2`（主打团 Root）和 Tenant Owner 角色，不复用一个角色表达两种治理语义。
6. 实现 Tenant Owner 模板与每个 tenant 唯一 active Owner。
7. 实现正常 Owner transfer：Step-Up 发起 → 目标接受 → 冷静期 → 可撤销 → 原子切换。
8. 在发起时 snapshot 目标 Principal、Membership、Credential version、subject/mobile digest；冷静期内任一变化使接受失败。
9. 实现 Root 强制撤换为独立 governance Operation；不得复用日常 role API。
10. transfer 后验证新 Owner 可 create/revoke 邀请，旧 Owner 返回 403，bootstrap restart 返回动态 existing。
11. 最后增加 Console tier 展示、授权约束提示与 Owner 转让界面。

角色回填是业务判断，不能机械完成。新任务应先导出现有角色、permission、scope 与使用入口清单，再由 Owner 确认哪些属于 1000／500／100 或纯职能角色。

## 8. 隔离 staging 与部署边界

外部状态只按当前会话证据登记：

- staging 候选：ECS `i-2zeewhay0farxq8lucrc`，末尾为 `c`；用户于 2026-08-30 表示已清空，但尚无清空后只读证据。
- 正式机：ECS `i-2zeewhay0farxq8lucrd`，末尾为 `d`；正在承载现有公网服务，严禁触碰。
- 两个 ID 仅最后一位不同，每个动作前必须完整比对。
- 先前只读证据显示北京地域 RDS 与 Tair 为 0；该状态可能变化，创建前必须重新核验并取得成本批准。
- KMS 产品页可见不等于 KMS 已配置；RAM 角色列表可见不等于当前身份有写权限。
- 当前没有新版权限系统的公网预览 URL；`127.0.0.1:4173` 只是本地页面。

部署顺序：

1. 只读核验 `…ucrc` 清空后的镜像、磁盘、VPC、vSwitch、安全组、公网/EIP、RAM role 和现有 workload。
2. 权限代码 P0 全部关闭并形成 clean release SHA。
3. 对 RDS、Tair、KMS/Secret、网络和短信配置分别取得明确批准与费用上限。
4. 在隔离数据源上完成 migration → reconciliation → Owner bootstrap → readiness。
5. 仅使用临时 staging Host，不改正式 DNS，不读取正式数据。
6. 完成公网 E2E 后才能讨论将候选服务器晋升为正式环境。

需要用户在云控制台操作的步骤继续发送到：

```text
codex://threads/01a042bb-0d0f-7000-a89a-751c8b00cfe4
```

## 9. 最小验收矩阵

以下全部通过才可称“权限 MVP 公网跑通”：

| 场景 | 预期 |
|---|---|
| Root 登录 Console | 成功；Session、CSRF、Access Version 完整 |
| Root 创建管理员邀请码 | 201；明码只出现一次；审计无明码 |
| 非 Root 创建或撤销邀请码 | 403 |
| A tenant 对 B tenant 发码 | 403 |
| 邀请请求提交角色 | 400 或忽略；不能采用客户端角色 |
| 短信 OTP | 测试手机真实送达；服务端不回显验证码 |
| 受邀注册 | storefront/operator 两个 Membership 原子建立 |
| 初始 operator 登录 | 只能访问本人 Session；租户业务 Permission 为空 |
| 旧 Session 在角色变更后重放 | 403／要求刷新或重新登录 |
| Root 重置非 Owner 身份 | 历史保留、登录手机号释放、旧 Session 全撤销 |
| Root 重置自己或 Owner | 拒绝 |
| 同手机号重新受邀注册 | 成功建立新身份，不复活旧权限 |
| Owner 正常转让 | 冷静期后唯一新 Owner；旧 Owner 权限和 Session 失效 |
| transfer 后邀请 | 新 Owner 成功；旧 Owner 403 |
| forged shopjob Session/AAL3 | 数据库拒绝 |

## 10. 新任务的启动指令

可将以下内容作为新 Codex 任务的第一条消息：

```text
请先完整阅读 main/docs/membership-permissions/08-PERMISSION-SYSTEM-HANDOFF-20260830.md，严格只在 main/ 工作。先做只读 Git 分层核验，保护当前 179 个 tracked 修改和 157 个 untracked 项，不得 reset、clean 或直接 pull。以 origin/main 与当前 working tree 的权限相关 diff 为依据，先形成可恢复的权限切片和 clean 基线；随后依次关闭 Authz tenant fail-open、shopjob 安全表 raw DML、tier/向下授权约束、Owner transfer/bootstrap 阻断。每一阶段必须给出真测试证据，P0 未关闭前不得部署、接公网或触碰正式 ECS …ucrd。需要我操作阿里云控制台时，把单一步骤发到 codex://threads/01a042bb-0d0f-7000-a89a-751c8b00cfe4，等待我完成后再核实。
```

## 11. 完成定义

新任务只有在以下条件同时满足时才能宣布完成：

- 权限改动位于单一可审计 clean SHA，且已安全吸收 `origin/main`。
- Authz、tier、角色授权、Owner transfer、bootstrap 与 job ACL 全部 fail closed。
- PGlite 与真 PostgreSQL 全量 migration replay 均通过。
- TypeScript、合同生成、数据库对象合同和相关 Console 测试通过。
- 隔离 staging 有脱敏运行证据、真实测试短信与完整浏览器 E2E。
- 正式 ECS、正式数据、正式 DNS 与正式流量未被修改。

