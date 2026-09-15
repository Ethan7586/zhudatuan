# Delivery Control 1.5 readiness contract

状态：第一批本地候选。现役生产控制面仍由根目录 `AI-DELIVERY.md` 声明。

`node 04_tools/release-engine/cli.mjs doctor --source-sha <sha> --control-sha <sha> --target <target> --node <physical-node> --repository Ethan7586/zhudatuan --format json`
只执行读取与静态检查，输出 `ai.delivery.readiness-doctor.v1`。它不修改 Secret、RAM、Runner 或 OSS，不创建 Seal/Lease，不触发 Prepare/Deploy，不移动生产指针。

失败 Closure 的 Resume 还必须提供 `--base-sha <exact-ancestor>`。Doctor 同时证明：历史上存在该 source 的失败自动封板、base 是 source 的祖先、source 是最新控制面的祖先。自动封板手动重放复用同一个工作流和同一份 Closure schema；deploy-source 通过精确 artifact 名称识别 push 或手动恢复运行，不把工作流事件类型当作制品权威。

## 真实失败基线

- Run `35006316266`：历史 Secret 调用链缺口；后续 Run 已越过该阶段，因此不是当前唯一根因。
- Run `35022406367`：`runner-selection` 的 `OSS_LIST_FAILED / HTTP 403`。证据同时出现 `ResourceGroupLevelIdentityBasedPolicy`、`SubUser`、`ImplicitDeny` 和 bucket ownership 文案，只能形成候选原因，不能仅凭 403 宣布唯一根因。

## OSS 操作清单

| 阶段 | 调用位置 | 操作 | Key/Prefix | 身份 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Doctor | `doctor.mjs` | exact Head/Get | `<project>/<target>/<source>/release-index-r4-seal-lifecycle.json`，再由索引推导 final Seal | Observer | 不再 List；404 表示未准备，403 必须阻断 |
| Runner 路由 | `runner-routing.mjs` | List/Get/immutable Put | `runner-routing/v1/requests/<request-id>/` | Build orchestrator | lease generation 当前依赖 List |
| Runner 槽位 | `runner-routing.mjs` | List/Get/immutable Put | `runner-routing/v1/slots/<slot>/claims/` | Build orchestrator | claim generation 当前依赖 List |
| 制品索引 | `oss.mjs` | exact Get/Head/immutable Put | `<project>/<target>/<source>/release-index-r4-seal-lifecycle.json` | Build | 已知 Key，不需要 List |
| 制品对象 | `oss.mjs` | exact Get/Head/immutable Put | `<project>/<target>/<source>/<digest>/...` | Build | 已知 digest 后不需要 List |
| Seal 发现 | `oss.mjs` | List/Get | `.../seals/v1/<node>/` | Observer/Release | artifact digest 未知时依赖 List；从精确 release index 取得 digest 后可改为 exact Get |
| Seal 生命周期 | `seal-lifecycle.mjs` | List/Get/immutable Put | exact Seal root 的 `leases/`、`failures/` 和阶段回执 | Build/Release | generation 发现仍依赖 List |
| Writer Lease | `release-writer-lease.mjs` | List/Get/immutable Put | exact writer root 的 `leases/`、`renewals/` | Release | generation 发现仍依赖 List |
| Deploy | `oss.mjs` / remote agent | exact Get | final Seal、manifest、archive | Release | 不需要 bucket 枚举 |

第二批已经移除 Doctor 的 List，以及 Deploy 成功读取已知 final Seal 时的 List。仍须 List 的范围只有 generation 发现：Runner request lease、slot claim、未封板 Seal 的 lease/failure、Writer lease/renewal。

## OIDC/STS 与不可变指针后续协议

正式身份模式是 GitHub OIDC → 阿里云 `AssumeRoleWithOIDC`；`static-access-key` 只保留为必须显式选择并产生告警的兼容模式。信任必须同时绑定仓库、`zdt-next` 或受保护的 `production` Environment、可执行 workflow、事件和 audience。依据：[GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc)、[Alibaba Cloud AssumeRoleWithOIDC](https://www.alibabacloud.com/help/en/ram/developer-reference/api-sts-2015-04-01-assumerolewithoidc)。本批不创建真实 Provider/Role，也不执行真实 STS，所以信任关系保持 `UNVERIFIED`。

第三批若要消除 generation List，必须先实现并发安全的不可变指针协议：每个 generation 先写不可变记录；current claim 以预期前代 digest 为条件提交；同 generation 冲突必须停止；读方 exact Get current 后校验记录 digest、父链和作用域；迁移期间旧 List 只读、双读比较但不得双写；全部历史对象保留，禁止覆盖。OSS 条件写/CAS 能力和冲突演练未被证明前，不实施该协议，也不删除现有 List 权限。

`FINAL_SEAL_RECEIPT_MISSING` 不再等同于一种失败。机器决策固定输出 `failureClass`、`retryable`、`resumeAllowed`、`resumeFrom`、`nextSafeAction`、`exactResource`：一致的 final Seal 是幂等成功；uploaded 与 candidate validation 完整时从 `RESUME_FROM_FINAL_SEAL_WRITE` 继续；写结果不确定先 exact Head/Get；临时 STS 过期可有限刷新；403 不重试并报告身份、角色、action、精确路径；任一身份字段不一致立即安全阻断。完整自动 Resume 留给后续批次。

组件准备使用 `fail-fast: false` 的独立 matrix，Console 与 web-api 等组件互不因单个失败而取消构建/封板。整套生产切换必须等待 Closure 所需组件全部 final sealed；跨组件原子放行尚未实现，因此机器门禁明确保持关闭，不能以局部封板成功替代整套可切换。

## 第三批：权威状态机与 Resume 决策

Artifact Plane 只包含不可变证据：archive、manifest、provenance、release index、uploaded receipt、candidate validation、final Seal。Control Plane 只包含 request/attempt、owner/lease、retry budget、checkpoint、failure 和 resume decision。控制状态与 GitHub Job 结果都不能补造或替代 Artifact Plane 证据。

```text
ABSENT -> BUILDING -> UPLOADED -> VALIDATED -> SEALING -> SEALED
             |            |          |            |
             +------ FAILED_RETRYABLE / AMBIGUOUS_WRITE
                          |          |
                          +-- exact evidence reconcile --+

任何身份/摘要/provenance 冲突 -> FAILED_BLOCKED
活跃不同 owner                    -> OWNER_CONFLICT
403 / ImplicitDeny               -> FAILED_BLOCKED（修权限、Doctor 通过后从原 checkpoint 续跑）
```

`delivery-reconcile.mjs` 是后续编排唯一可复用的决策入口。它输入 source SHA、control-plane SHA、target、physical node、artifact digest、request/attempt、期望角色和 retry policy；只 exact Get uploaded、candidate validation、final Seal，并输出稳定 state/action 及完整恢复字段。`SEALED` 返回 `NOOP_ALREADY_SEALED`；仅 uploaded 返回 `RESUME_VALIDATION`；uploaded+validated 返回 `RESUME_FINAL_SEAL_WRITE`；不确定写先完成 exact readback；临时 STS 过期使用有限指数退避和抖动；403、身份冲突和 owner 冲突不盲重试。

组件状态独立 reconcile。`evaluateReleaseBundle` 只在本次 Closure 要求的每个组件都以完全一致身份达到 `SEALED` 时输出契约层 `ALLOW_CONTRACT_DEPLOY`，否则输出 `DENY_DEPLOY_INCOMPLETE_BUNDLE`。本批没有把该结果接入生产 Deploy。

release index 到阶段回执和 final Seal 已使用 exact key。Runner request lease、slot claim、未完成 Seal lease/failure、Writer lease/renewal 的 generation 仍需限定 Prefix 的 List。OSS 条件写或等价 CAS 尚未由适配器和本地并发契约证明，因此保留这些 List；禁止用普通覆盖 current 指针冒充原子操作。

## 第四批：单次触发编排候选

`production-orchestrator.mjs` 把第三批 reconcile 接入一次请求的本地编排合同：Doctor → 依赖图并行 Prepare/Resume → exact final Seal → bundle gate → Release Writer → canonical Deploy → health/rollback evidence。任何实际写动作的适配器只能执行系统级 `zdt-delivery prepare/deploy`，并核对其解析的最新 control-plane SHA；Deploy 不构建、不安装、不补 Seal。

请求、bundle gate、deploy receipt 和完成回执均按幂等键不可变记录。重复健康请求 no-op；不确定写先读回；临时网络与 STS 使用预算内退避；403、身份冲突、owner 冲突阻断。状态摘要输出组件 checkpoint、证据、下一动作、人工介入标志、时间线和耗时，并固定 `productionP95Claimed=false`。

现有自动 Closure 已包含 exact `head_sha`、可选 `base_sha` 和 ancestry 校验，可用最新控制面重评估历史主线版本；deploy-source consumer 不以 event 类型为权威，并识别受控 `workflow_dispatch` artifact。旧提交 `5135a7de137f353bb1a36c492aa8d377424a5c96` 不应重新 cherry-pick 覆盖现行主线语义。

本批仍是本地候选：没有安装一次触发系统命令，没有修改或运行真实 Workflow/RAM/OSS/Runner/生产，生产分维持 56/100。

Resume 不绕过 Readiness：OSS/RAM 403、Secret 合同、Runner 可见性或祖先关系任一失败都保持 `resumeAllowed=false`；只有修复原权限并重新通过 Doctor 后，才允许重放同一 source/base，不生成替代 source，不直接进入 Deploy。

## 最小权限矩阵草案

| 身份 | GitHub | OSS Get/Head | OSS List | OSS immutable Put | SSH/生产 |
| --- | --- | --- | --- | --- | --- |
| Observer/Doctor | Actions Runner 只读 | release index、Seal、回执 | 仅限定正式 project/target/source Prefix | 禁止 | 仅只读状态探针 |
| Build | Runner 只读 | Runner 路由、制品、Seal 上传阶段 | 仅 request/slot/Seal 精确 Prefix | Runner lease、制品、上传回执 | 禁止 |
| Release | Runner 只读 | final Seal、制品、Writer lease | 仅 Writer/Seal 精确 Prefix | 验证回执、final Seal、Writer lease | 指定物理节点部署通道 |

禁止 bucket 管理员和全桶通配。RAM 主账号归属、Bucket/Endpoint 区域、Resource Group、Identity Policy、显式 Deny 与 Prefix 范围必须分别核对。写能力无法由只读 Doctor 证明，固定输出 `UNVERIFIED_WRITE_CAPABILITY`。

## 评分

第一批只增加本地错误识别与合并前门禁证据。真实生产综合分维持 `56/100`；正确识别失败不等于生产成功路径通过。
