# 独立复核索引 v1（AU-906）

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 建立日期：2026-09-15
- 状态：**RV-0001 至 RV-0006、RV-0007 至 RV-0009、RV-0011、RV-0013 至 RV-0018、RV-0024 至 RV-0070 已完成；其余未编号高风险对象待复核。**
- 规则：每项复核从当前固定审计基线的运行入口/调用链重新取证；不得只复述首审报告。任何分歧保守保留，不降低风险等级。

## P1 候选（17）

| 首审问题 | RV | 模块 | 第二轮最小入口 |
| --- | --- | --- | --- |
| F-0001 | RV-0001（已完成，确认 P1） | Auth/Console/发布制品 | 公网入口 → manifest → 制品指针/健康检查 |
| F-0015 | RV-0002（已完成，确认 P1） | 正式发布 workflow | workflow → delivery 控制面 → 就绪/回滚 |
| F-0021 | RV-0003（已完成，确认 P1） | Secret Store/KMS | 生产入口 → 工作负载授权 → 密钥解析 |
| F-0022 | RV-0004（已完成，确认 P1） | Outbox/Runtime Scheduler | target 注册 → Jobs/relay producer-consumer |
| F-0023 | RV-0005（已完成，确认 P1） | PostgreSQL 编排 | compose/init → 实际版本/迁移前置 |
| F-0029 | RV-0007（已完成，确认 P1） | Console node domain | manifest domain → runtime URL → target/health |
| F-0036 | RV-0008（已完成，确认 P1） | Storefront member 写权限 | route → authorization → DB 写入/RLS |
| F-0053 | RV-0009（已完成，确认 P1） | 自定义角色委派 | role grant → capability ceiling → 数据库/契约 |
| F-0065 | RV-0011（已完成，确认 P1） | 遥测/审计脱敏 | 生产入口 → redactor → 输出/持久化 |
| F-0094 | RV-0013（已完成，确认 P1） | Provider webhook | provider event → 签名 → event-id 去重 |
| F-0096 | RV-0014（已完成，确认 P1） | Vendor 连接 | 配置/base URL → 签名传输 → allowlist |
| F-0097 | RV-0015（已完成，确认 P1） | Vendor 响应资源限制 | transport → byte/JSON 深度 → caller/retry |
| F-0100 | RV-0016（已完成，确认 P1） | Foodvoucher Provider | registry → manifest → 三条可达生产链 |
| F-0103 | RV-0018（已完成，确认 P1） | Foodvoucher health | required installation → read adapter → readiness |
| F-0241 | RV-0024（已完成，降为 P2） | 券资金写入 | RPC → action permission → service-role/RLS/ledger |
| F-0243 | RV-0025（已完成，确认 P1） | 财务动作凭证 | proof issuance → command transaction consumption |
| F-0252 | RV-0026（已完成，降为 P2） | 财务对账 | candidate selection → ambiguity → ledger/result |

## GX（47 个已枚举）

| 范围 | 首审对象族 | 第二轮最小入口 |
| --- | --- | --- |
| GX-0001 | 聚合 Jobs 控制面（RV-0006 已完成，维持 GX） | launcher/registry → producer → worker/retry/deadletter |
| GX-0002 | Auth owner-approved 旧登录实现（RV-0027 已完成，维持 GX） | current auth entry → compatibility adapter → session/permission |
| GX-0006 | 平台 Owner 调和迁移（RV-0028 已完成，维持 GX） | migration ledger → current owner invariant → retention/recovery |
| GX-0007 | 库存单一事实源切换（RV-0029 已完成，维持 GX） | migration → backfill/retirement → current stock/job consumer |
| GX-0008 | 全域历史数据回填（RV-0030 已完成，维持 GX） | secure stage → domain projection → reconciliation/retirement |
| GX-0009 | 全域历史数据对账（RV-0031 已完成，维持 GX） | evidence/hash → fail-closed assertions → legacy retirement |
| GX-0010 | legacy 数据库对象退役（RV-0032 已完成，维持 GX） | reconciliation → maintenance-window drop → target-head assertion |
| GX-0011 | 权益旧流水到财务总账（RV-0033 已完成，维持 GX） | benefit entries → finance journal/lot → current Worker/read model |
| GX-0012 | 财务账本与结算生命周期迁移（RV-0034 已完成，维持 GX） | finance facts/RLS → settlement/withdrawal Worker → recovery/retention |
| GX-0013 | 渠道外部对象 scope 映射（RV-0035 已完成，维持 GX） | migration → channel sync → scope/RLS/恢复 |
| GX-0014 | 客服 case 到 conversation/ticket（RV-0036 已完成，维持 GX） | migration → command/Worker → scope/证据/恢复 |
| GX-0015 | 通知投递与成员可见性（RV-0037 已完成，维持 GX） | migration → event/Worker → member RLS/恢复 |
| GX-0016 | 报表投影与导出授权（RV-0038 已完成，维持 GX） | migration → projection/export → object/RLS/恢复 |
| GX-0017 | 外部扩展安装与健康状态（RV-0039 已完成，维持 GX） | migration → health job → loader/secret/RLS |
| GX-0018 | 批量导入进度、暂存行与报告（RV-0040 已完成，维持 GX） | migration → import job → scope/staging/recovery |
| GX-0019 | 成员与券批量导入完成（RV-0041 已完成，维持 GX） | migration → import API/job → sensitive staging/recovery |
| GX-0020 | Membership 从 member 到 access（RV-0042 已完成，维持 GX） | migration → identity/access → session/role/readiness |
| GX-0021 | 微信支付应用场景隔离（RV-0043 已完成，维持 GX） | migration → payment/webhook → app binding/恢复 |
| GX-0022 | 成员个人数据 scope 授权函数（RV-0044 已完成，维持 GX） | migration → API context → RLS/member boundary |
| GX-0023 | 支付 Webhook scope resolver 演进（RV-0045 已完成，维持 GX） | migrations → webhook → scoped function/RLS |
| GX-0024 | 跨域 member audience 契约（RV-0046 已完成，维持 GX） | migration → capability → personal scope/RLS |
| GX-0025 | Runtime contract head checksum（RV-0047 已完成，维持 GX） | checksum/ledger → startup/readiness/release gate |
| GX-0026 | Membership 权威函数 schema 重绑（RV-0048 已完成，维持 GX） | migration → function definition → identity/access callers |
| GX-0027 | Membership scopegrant 历史规范化（RV-0049 已完成，维持 GX） | normalization → scope resolver → active grants |
| GX-0028 | Runtime target-head error-contract 封板（RV-0050 已完成，维持 GX） | target checksum → later migration guards → error contract |
| GX-0029 | Invitation 生命周期与注册政策绑定（RV-0051 已完成，维持 GX） | policy migration → invitation/registration route → lifecycle |
| GX-0030 | Invitation resource scope resolver 演进（RV-0052 已完成，维持 GX） | resolver migration → Experience/Access → resource scope |
| GX-0031 | Identity session 管理与撤销事件（RV-0053 已完成，维持 GX） | session operations → revocation/event → authenticated requests |
| GX-0032 | Store management scope 与授权函数演进（RV-0054 已完成，维持 GX） | scope migration → provisioning runtime → permission function |
| GX-0033 | Decision audit actor/scope RLS 修复（RV-0055 已完成，维持 GX） | RLS policy → risk decision writer → scoped audit reads |
| GX-0034 | Platform Owner 门店管理权限授予（RV-0056 已完成，维持 GX） | owner permission → partner operation → scope gate |
| GX-0035 | Console member manage/password assurance（RV-0057 已完成，维持 GX） | operation contract → member lifecycle → session assurance |
| GX-0036 | Console contract runtime ledger 封板（RV-0058 已完成，维持 GX） | migration ledger → readiness/repair → compatibility |
| GX-0037 | Platform Owner Console 只读授权（RV-0059 已完成，维持 GX） | permission grant → capability → Console/API read gates |
| GX-0038 | Platform Owner card library read（RV-0060 已完成，维持 GX） | permission grant → voucher read → sensitive-field projection |
| GX-0039 | Platform Owner Cockpit catalog/inventory read（RV-0061 已完成，维持 GX） | permission grant → read handlers → scope boundary |
| GX-0040 | Reporting Cockpit 跨域汇总（RV-0062 已完成，维持 GX） | Dashboard → repository → cockpit overload/RLS |
| GX-0041 | 历史测试登录材料（RV-0063 已完成，维持 GX） | 文档 → current domain/account governance/rotation evidence；禁止尝试登录 |
| GX-0042 | Cakeuncle 专用 Webhook/签名（RV-0064 已完成，维持 GX） | verifier → barrel → provider registration → protocol/recovery |
| GX-0043 | Cake OrderRequest 履约契约（RV-0019 已完成，维持 GX） | manifest/factory → order port → request/idempotency/recovery |
| GX-0044 | Meal OrderDraft 下单契约（RV-0020 已完成，维持 GX） | manifest/factory → order port → non-idempotent request/recovery |
| GX-0045 | 公司模板克隆（RV-0065 静态复核完成，专项验证待授权） | DB function → role/RLS → topology/identity clone/recovery |
| GX-0046 | Storefront compatibility legacy 运维（RV-0066 已完成，维持 GX） | legacy deploy → purchase guard → systemd/backup recovery |
| GX-0047 | Linux readiness fixture（RV-0067 已完成，维持 GX） | isolated unit → readiness/rollback → protected snapshots |
| GX-0048 | Identity mobile consistency repair（RV-0068 已完成，维持 GX） | precondition/collision → credential version → session revoke |
| GX-0049 | 供应商业务模拟数据 seed/cleanup（RV-0069 已完成，维持 GX） | explicit manual invocation → namespace/transaction → cleanup/assertion/recovery |
| GX-0050 | Console release build 编排（RV-0070 已完成，维持 GX） | manual release tool → clean SHA → external artifact → browser verification |

## 未编号高风险台账差额（12 个对象 + 2 个计数未知项）

历史累计报告 GX 52，而当前机械枚举有 47 个 `GX-####` ID。AU-962 从首审结论恢复了 12 个确有对象的未编号 GX；其中 9 个已编为 GX-0042 至 GX-0050，另 3 个对象与 2 个仅存在于累计数字的未知项仍待收口。**这些差额均不可视为可删除或降级；尤其不得把“2”虚构为候选对象。**

重建顺序：先为上述 12 个对象补唯一 GX ID 和独立复核入口；再从历史候选累计变动/提交记录追溯两个计数未知项。如果证实是重复汇总或不再适用，也必须保留原始证据与裁决理由。

## G3

首轮累计为 0。最终收口前仍须确认没有被未定位 GX/G1 或历史清单掩盖的 G3 项。
