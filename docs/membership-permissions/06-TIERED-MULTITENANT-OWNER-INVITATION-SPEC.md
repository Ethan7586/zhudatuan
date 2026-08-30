# 主打团分级多租户权限代码规范

- 版本：1.0
- 决策日期：2026-08-29（Asia/Shanghai）
- 状态：Owner 已确认方向；按安全切片实施
- 需求输入：`/Users/Ethan/Desktop/主打团分级权限模型.html`
- 适用范围：Canonical `identity`、`access`、`member`、Console 与 Auth Web

这份文件把需求稿转换成可执行的工程约束。需求稿用于说明业务意图，不作为脚本、迁移或运行命令执行。

## 1. 权威术语

以下概念不得混用：

| 名称         | 含义                               | 不能代表         |
| ------------ | ---------------------------------- | ---------------- |
| Principal    | 可认证的自然人账号                 | 某个组织内的权限 |
| Profile      | 人的展示资料                       | 登录凭证         |
| Membership   | 某人在某入口、某组织内的身份       | 自然人本身       |
| Role         | 一组可叠加的职能权限               | 组织层级         |
| Tier         | 谁可以管理、授权谁                 | 财务、客服等职能 |
| Scope Grant  | 可以操作哪些实体                   | 可以执行什么动作 |
| Permission   | 可以执行什么动作                   | 可访问哪些实体   |
| Capability   | 当前部署与套餐是否开放某 Operation | 人员授权         |
| 管理员邀请码 | 建立受邀身份的一次性随机凭据       | 短信验证码       |
| 短信验证码   | 证明手机号控制权的短期 OTP         | 管理员授权       |

代码、接口和界面一律使用“管理员邀请码”；“获取验证码”只用于短信 OTP。

## 2. 三个互相隔离的权限域

```text
Control plane
└─ 主打团 Root Owner：租户治理，不天然拥有租户业务数据权限

Tenant boundary（tenant_id 必填）
└─ 平台层
   └─ 分销层
      └─ 集团层
         └─ 商城层（应用 = 商城）

Personal
└─ 本人账号、密码、手机、Session、地址等
```

门店、供应商、品牌、商品是业务实体或关系，不新增为第五个组织层级。门店后台与供应链后台是操作入口，不是组织树节点。

权限代码必须归入以下域之一：

```ts
type PermissionDomain = 'personal' | 'governance' | 'operation';
```

- `personal` 只允许作用于本人，不进入实体包含算法。
- `governance` 管理租户生命周期、Owner 恢复与安全元数据。
- `operation` 管理订单、商品、财务、会员等租户业务。
- Root 的 `governance` 权限不得隐式转换为任何 `operation` 权限。
- 需要介入租户业务时必须走显式、限时、可撤销、全审计的 break-glass 流程。

## 3. 管理位阶与职能角色

租户内位阶固定预留间距：

| 位阶         | tier | 约束                 |
| ------------ | ---: | -------------------- |
| Tenant Owner | 1000 | 每个有效租户恰好一名 |
| Senior Admin |  500 | 可邀请、可向下授权   |
| Admin        |  100 | 初始管理权限为空     |
| Reserved     |    0 | 不作为可授予管理位阶 |

主打团 Root Owner 是控制平面角色，不参与租户 `effectiveTier` 计算。财务、客服、券审批、资格审批等是并列职能角色，可以叠加，但不互相形成上下级。

同一 Membership 的有效位阶为其当前有效角色的最高 tier。每次授权必须由服务端同时断言：

```text
targetMember.effectiveTier < actor.effectiveTier
targetRole.tier < actor.effectiveTier
targetRole.permissions ⊆ actor.effectivePermissions
actor.entityScope contains targetGrant.entityScope
actor.tenantId = targetMember.tenantId = targetRole.tenantId
```

任一值缺失、无法解析或不相等都必须拒绝。前端禁用按钮不能代替这些断言。

## 4. 身份与实体权限必须分开

个人身份只保存认证和本人安全信息；组织权限只存在 Membership 上：

```text
Principal 1 ── 1 Profile
Principal 1 ── N Membership
Membership 1 ── N Role
Membership 1 ── N Scope Grant
```

同一人可以同时拥有：

- `storefront` Membership：购物、本人福利与订单；
- `operator` Membership：Console 管理身份；
- 后续独立的 `store` / `supplier` Membership。

禁止把管理角色挂到 `Principal` 或 `Profile`；禁止用手机号、用户名或前端菜单推断权限。

## 5. 首个 Root Owner

首个 Root Owner 只能由一次性 bootstrap 建立，不能由普通注册、邀请或角色管理接口产生。

固定不变量：

```text
active control-plane Root Owner count = 1
active Tenant Owner count per active tenant = 1
```

bootstrap 必须：

1. 只从 Secret Store reference 读取 identity key 与随机强密码；不得在 SQL、Git、命令行或日志中出现明文。
2. 使用独立低权限数据库角色、固定数据库边界、显式确认串、serializable transaction 与 advisory lock。
3. 原子建立 Principal、Credential、Profile、`operator` Membership、Owner Role、Platform/Tenant/Self Scope 与不可篡改审计。
4. 对完全一致状态可重跑并返回 `existing`；任何部分碰撞返回 conflict，不做猜测式修复。
5. 密码指纹按原始字节做 domain-separated HMAC；不得 trim 或 lowercase。
6. 结束前验证 Console 登录所需 Permission、Capability、Access Version 与 ACL。

当前本地验收 Owner 使用稳定身份 `ethan` 和 Membership `membership-platform-owner-ethan-v1`；密码仍由本地 Secret Store 提供，不写入仓库。

Root、Tenant Owner 都不得被日常成员／角色 API 停用、删除或降级。Owner 保护 trigger 与合法转让函数必须同批发布。

## 6. 管理员邀请码

### 6.1 发码

- 仅 Root Owner 或 `tier >= 500` 且持有 `identity.invitation.manage` 的管理身份可发码。
- 请求不能带角色选择；服务端固定绑定该租户的 `role-console-pending`。
- 邀请码使用至少 192 bit CSPRNG，数据库只保存 keyed digest。
- 明码只在创建成功的响应中显示一次，不进入 URL、Query Cache、localStorage、审计、日志或 telemetry。
- idempotency 表只能保存“该明码响应不可重放”的 409 回执，不能保存明码。
- 邀请必须绑定组织、目标入口、条款版本、有效期、最大使用次数、创建人和版本。

### 6.2 受邀注册

受邀注册必须在同一数据库交易中建立两个 Membership：

```text
storefront + role:self shopper baseline
operator   + role-console-pending + personal self baseline
```

`role-console-pending` 的租户业务 Permission 集合必须为空；`role:self` 只提供登录、Session 与本人安全中心等 personal 能力，不算管理权限。

任一凭据、条款、邀请码、Profile、Membership、Role 或 Scope 写入失败，整笔注册回滚。不能留下只有购物身份或只有后台身份的半成品。

### 6.3 短信 OTP

受邀人仍需通过身份服务取得 registration OTP，用于证明手机号；Owner 不能手工生成或读取 OTP。邀请码与 OTP 必须分别校验，任一失败都不得消费另一项授权。

## 7. 服务端代码规范

- Operation 是唯一业务写入口；Controller 不写 SQL，前端不直连数据库。
- 所有输入与输出在边界做严格 Schema 校验，结构型合同不能成为信任输入的理由。
- SQL 必须参数化；邀请码、密码、OTP、Session、Action Proof 不能拼接进 SQL 或错误文本。
- 授权顺序固定为 Audience → Membership → Access Version → Permission → Tenant/Scope → Capability → Assurance → Risk。
- 高风险写入必须携 idempotency key；资源更新同时携 expected version。
- 一个业务动作只提交一个事务；事件与审计在同一事务内写入 outbox／账本。
- 角色或 Scope 变化必须只递增一次受影响 Membership 的 Access Version。
- 缺少 tenant、scope、capability、assurance 或解析失败时一律 fail closed。
- 不允许 `platform => true`、`tenant undefined => allow` 或按角色名称在前端放行。

## 8. Console 代码规范

- 操作入口同时检查服务端返回的 Permission、Capability 与 CSRF 存在性；这只是 UX 门槛，服务端仍重验。
- 不显示角色选择器；邀请码固定生成待授权管理员。
- 提交期间禁止重复操作；关闭成功回执时立即清空内存中的邀请码。
- 复制邀请码必须由用户显式触发，并处理 Clipboard API 不可用。
- API 响应必须经 Zod 严格解析；畸形成功响应按失败处理。
- 403、409、429、网络错误使用可理解文案，不回显内部 SQL、堆栈或秘密。
- 表单必须有可访问名称、关联 label、错误状态与键盘关闭路径。

## 9. Owner 转让

正常 Tenant Owner 转让流程固定为：Step-up 发起 → 目标接受 → 24–72 小时冷静期 → 可撤销 → 到期原子切换。旧 Owner 降为 Senior，新 Owner 升为 Owner，事务末尾重新断言该租户恰好一名有效 Owner。

Root 强制撤换是独立 governance Operation，不复用 `access.roles.manage`。所有正常／强制转让都必须产生不可篡改审计并立即使旧授权版本失效。

## 10. 最小验收矩阵

| 场景                             | 预期                                         |
| -------------------------------- | -------------------------------------------- |
| Root 登录 Console 后发码         | 201；明码只出现一次                          |
| 同一 idempotency key 重放        | 409；响应和数据库均不含明码                  |
| 普通 Admin 发码                  | 403                                          |
| A 租户替 B 租户发码              | 403                                          |
| 邀请请求提交角色                 | 忽略或 400；绝不采用                         |
| 受邀注册完成                     | 同人同时有 storefront 与 operator Membership |
| 待授权管理员登录                 | 可读本人 Session；租户业务 Permission 为空   |
| 任一步失败                       | 两个 Membership 均不存在，邀请码不被消费     |
| Owner 被普通 API 停用／撤角      | 数据库拒绝                                   |
| 角色／Scope 变更后使用旧 Session | 403，要求重新登录／刷新                      |

## 11. 分阶段边界

本次首个可验收切片只开放：本地首个 Root Owner、Root 发管理员邀请码、邀请码一次展示、双 Membership 注册与 Console 发码界面。

以下能力仍需独立迁移与验收后才能开放：完整 19 个旧角色 tier 回填、Tenant Owner 模板、Senior Admin 授权、Owner 转让、Root 强制撤换、break-glass、多租户隔离总矩阵。未完成项不得用前端 mock 或宽松默认值替代。
