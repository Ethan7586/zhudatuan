# AU-010｜`@shop/authz` 权限决策内核

## 1. 唯一目的与边界

本单元只审固定基线中 `@shop/authz` 的全部文件，以及 permission、scope、decision 进入真实 `AccessPipeline`、角色管理、Console 和 contractgen 的第一层接缝。审计顺序为包入口与消费者 → 逐文件/逐导出/逐函数 → 判定顺序与失败分支 → 生产 scope 来源和角色投影 → 定向反事实 → 测试可信度。

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 审计分支：`codex/full-codebase-audit-20260913`；开工 HEAD/CP-09 为 `e000e3a9036d4628f25017b591848489c7754045`。
- 开工只读观察 `origin/zdt-next` 为 `76da55adaebc7a35e8257d42c83c5f38bba48f5b`；没有 merge、rebase 或 cherry-pick，后续主线变化不改变本次基线。
- 纳入：Authz 10 个 tracked 文件/397 行、18 个公开符号、184 条 permission、329 个受保护 Operation 绑定、29 个 `@shop/authz` 源码 import 消费者、4 个消费者 package 声明，以及 AccessPipeline、数据库授权投影、Access 角色管理和 Console 的第一层接缝。
- 排除：`@smart-wing/authz` 的实现深审、全部业务 handler 语义、线上角色/授权数据、生产日志、数据库重放、依赖安装、任何修复、删除、推送、合并或部署。

## 2. 覆盖

- [FACT][E-AU-010-002] 10/10 个 Authz 文件、397/397 行完成逐文件和逐关键逻辑深入审阅；7 个生产 TypeScript、1 个测试、2 个配置/清单均为人工维护，无生成、第三方或构建产物。
- [FACT][E-AU-010-003] 根入口通过 6 个 barrel 导出 18 个声明符号。固定仓库有 29 个源码文件直接 import `@shop/authz`，另有 contractgen 直接跨目录 import `PermissionCatalog.ts`；4 个消费者 package 声明依赖。
- [FACT][E-AU-010-004] PermissionCatalog 有 184 个唯一 code、33 个 category；风险分布为 low 43、elevated 24、high 63、critical 54。345 个 Operation 中 329 个带 permission，使用全部 184 个 code，未知和未使用 code 均为 0。
- [FACT][E-AU-010-015] 对权限内核高风险文件 `Policy.ts`、`PermissionCatalog.ts`、`Policy.test.ts` 做了第二遍从消费者反向重追，占包文件 30%；结论一致。该复核仍由同一主审完成，不冒充 RV-0009 或 RV-0008 的第二位独立审阅者。

本单元新增 P1 候选 1 项、P2 3 项、P3 3 项；新增 G1 1 项。没有 P0、G2、G3 或 GX。全仓累计变为 P0 0、P1 候选 8、P2 34、P3 16、NIT 1；G0 2、G1 10、G2 0、G3 0、GX 1。

## 3. 真实运行关系

~~~mermaid
flowchart LR
  Ops[operations.yml] --> CG[contractgen]
  PC[PermissionCatalog 184] --> CG
  CG --> OC[OperationCatalog / generated controller]
  CG --> DBP[access.permission + capability.operation]
  OC --> PA[PipelineAuthorizer]
  PA --> AP[AccessPipeline]
  DB[(PostgreSQL)] --> SR[Session / Membership / Version / Scope resolvers]
  SR --> AP
  AP --> PRE[precheck]
  AP --> SCOPE[checkScope]
  AP --> STEP[checkAssurance + StepupPolicy]
  AP --> CAP[Capability / availability / risk]
  AP --> HANDLER[ModuleOperations]
  AP --> AUDIT[access.decisionaudit]
  CONSOLE[Console role/profile UI] --> PC
  ACCESS[Access role assignment] --> SCOPE
~~~

[FACT][E-AU-010-005/006] Authz 不是独立服务、进程、数据库 owner 或发布单元。它被编进 Console、Commerce、SDK、contractgen 和质量测试；生产授权由 7 个 Commerce runtime 构造的 `AccessPipeline` 执行。

[FACT][E-AU-010-006] 正常请求顺序为 Session → Audience → Feature → session-bound Membership snapshot → Membership ID → current access version → `precheck` → scope resolver → `checkScope` → governance/mall context → capability → resource readiness → `checkAssurance` 与 StepupPolicy → risk → 可选 financial proof → decision audit → handler。角色本身不属于 Authz 包；数据库把有效角色、override 和 scopegrant 投影成 `MembershipAccess.denies/grants`。

[FACT][E-AU-010-007] PostgreSQL resolver 使用数据库 `evaluated_at` 作为 membership grant 的统一判定时间，并分别核对 session、membership projection 和 current membership version；这是值得保留的快照与失效设计。Scope 正常来自 `access.resolve_session_scope`、`web_member_scope` 或 `web_storefront_scope`，而非浏览器直接构造。

## 4. 已确认问题

| 编号 | 等级 | 结论 |
| --- | --- | --- |
| F-0053 | **P1 候选** | 拥有 `access.role.manage` 的非 Owner 可用自定义角色封装并转授自己未拥有、且内建高级管理员明确排除的关键权限；服务端没有 actor permission subset/owner-only code 约束 |
| F-0054 | P2 | `access.roles.manage` 的二级 `access.scope.manage` 检查直接调用 `checkScope`，跳过该 permission 的显式 deny；确定性反事实仍返回 evidence |
| F-0055 | P2 | `contains` 对异常 Scope 失效关闭不足：platform grant 无条件覆盖、非 platform 缺 tenant 会跳过隔离、相同 ID 可跨 kind 命中；正常 canonical DB 路径降低但不消除边界风险 |
| F-0056 | P2 | `WebBusinessScopeResolver` 已改用 7 参数 session-bound resolver，正式 unit test 仍期待旧 4 参数函数且 fixture 缺 membership context，执行时在查询前失败 |
| F-0057 | P3 | PostgreSQL `bigint` 的 `access_version` 实际由 pg 8.16.3 返回 string，三个 resolver 和 AccessContext 却声明 number；现行严格比较碰巧同为 string，测试全部 mock number |
| F-0058 | P3 | contractgen 已声明 `@shop/authz` 依赖，却跨 workspace 相对路径直读 `PermissionCatalog.ts`，绕过包 export 和边界 |
| F-0059 | P3 | PermissionCatalog 有 `approval` category，Console 两份重复 category label 映射均遗漏，权限界面退回显示英文 `approval` |

同时补强但不重复计数：

- [FACT][E-AU-010-009] 184 个 definition 外壳和 catalog 外层被冻结，但 `scoped`、`operator`、`all` 与导出的 `SCOPE_KINDS` 数组没有冻结；修改一条默认 permission 的 `scopes` 会同时改变另外 79 条 permission 的授权接受集。这把既有 F-0032 从配置对象扩展到权限决策事实源。
- [FACT][E-AU-010-004/014] 两条 storefront member 写 Operation 的 `member.read` 绑定会被 contractgen、数据库 capability 和 AccessPipeline 原样执行；AU-010 独立重追了内核入口，但仍是同一主审，不能据此关闭 F-0036 的 RV-0008。
- [FACT][E-AU-010-003/013] `decide` 及其完整 Decision façade 没有仓内生产调用者；正式 AccessPipeline 使用三个分阶段函数。它仍是公开 API 和两组测试的唯一纯判定契约，只能列为 DC-0012/G1，不能删除。

## 5. 判定、状态与失败传播

- `precheck` 顺序固定为 inactive → access-version stale → explicit deny → permission known → 有效 grant；默认拒绝。
- `checkScope` 先校验 permission 允许的 resource kind，再查同 permission、有效期和 containment；它有隐藏前置条件：调用者若把它独立用于另一 permission，必须先执行该 permission 的 `precheck`。
- `checkAssurance` 只对 critical permission 要求 900 秒内、非未来的 step-up 时间；AccessPipeline 再由 StepupPolicy 检查 assurance level 至少 3。两层默认窗口一致，仓内没有生产自定义窗口。
- grant 在 `effective <= now` 时生效，在 `expires > now` 时仍有效；到期时刻本身拒绝。无效时间字符串会使 grant 不生效，属于 fail closed。
- AccessPipeline 的任何失败都会先尝试写 decision audit 再抛出；audit sink 失败会保持请求不进入 handler，但可能遮蔽原始拒绝原因。未取得线上频率，不单独登记 finding。

## 6. 测试可信度

- Authz 自身 1 个测试文件、4 个用例，覆盖默认拒绝、显式 deny、允许/拒绝 scope kind、版本、step-up、层级祖先、跨 tenant 与 expiry。
- 安全测试另有 2 个 Node test；AccessPipeline 有 45 个展开实例，完整覆盖 5 个维度的 32 种布尔组合、首个失败顺序、audience、membership ID 和 handler scope 传递。
- 关键缺口：inactive/future-effective/边界时间、未知 permission、目录重复、异常或缺 tenant、错误 platform、跨 kind 同 ID、catalog mutation、critical pipeline level、二级 permission 显式 deny、真实 pg bigint 类型。
- `WebBusinessScopeResolver.test.ts` 的第三个用例已与 2026-09-12 session-bound 改动漂移；实际源码探针得到 `AUTH_MEMBERSHIP_CONTEXT_MISSING` 且数据库调用数为 0。
- 正式 `npm test --workspace @shop/authz` 与 `npm run typecheck --workspace @shop/authz` 都以 127 在加载源码前退出，分别缺 `vitest`、`tsc`。未安装依赖；结果既不是通过，也不是实现失败。

## 7. 值得保留的设计

- Permission code、risk、scope kind 和 critical step-up 元数据集中在一个目录，184 个 code 与 329 个受保护 Operation 精确闭合。
- `precheck/checkScope/checkAssurance` 将一次判定拆成可由 AccessPipeline 插入 session、capability、risk 和 proof 的明确阶段，同时 `decide` 保留纯函数契约。
- 显式 deny 在正常完整判定中早于 allow grant；membership/version/scope/capability/risk 都是服务端解析，前端隐藏不是最终授权。
- Membership snapshot 使用数据库时间，session 和 current membership version 双重核对，授权通过/拒绝/挑战/复核都有 decision sink。

## 8. UNKNOWN 与后续边界

- [UNKNOWN] 线上是否存在被授予 `access.role.manage` 的自定义角色、通过该入口创建的越权角色或实际滥用记录；因此 F-0053 不是 P0，且在 RV-0009 前不作最终 P1。
- [UNKNOWN] 仓外是否调用 `@shop/authz` 的 `decide`、类型或 package export；private workspace 不等于无外部源码/历史制品消费者。
- [UNKNOWN] 正常数据库中是否存在缺 tenant、错误 closure、scope ID 跨表冲突或非 canonical resolver 输出；本 AU 没有连接线上数据库。
- [UNKNOWN] 七个非 GET、但绑定 `.read` permission 的 Operation 中，除已证明的 F-0036 两条外，其余五条是否属于产品认可语义；留给 Identity、Member、Order、Voucher 业务 AU，不从命名直接定罪。
- [UNKNOWN] 正式 test/typecheck 的实现结果；依赖缺失阻塞在源码加载前。
- `@smart-wing/authz` 是另一套真实生产授权实现，由 AU-011 单独审阅；本单元没有把两者混成等价替代或垃圾依据。

## 9. 本检查点结论

AU-010 完成的是固定基线 Authz 架构、权限目录、运行链和代码健康档案，不是修复。没有修改生产代码、测试、配置、迁移、依赖、锁文件或生成物，没有读取或改变线上状态，也没有推送、合并或部署。CP-10 后停止；AU-011 只有在 Ethan 明确开始后才审 `@smart-wing/authz`。
