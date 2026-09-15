# 独立复核索引 v1（AU-906）

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 建立日期：2026-09-15
- 状态：**RV-0001 至 RV-0005、RV-0007 至 RV-0009、RV-0011、RV-0013 至 RV-0016 已完成；其余第二轮结论尚未开始。**
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
| F-0103 | RV-0018 | Foodvoucher health | required installation → read adapter → readiness |
| F-0241 | 未编号 | 券资金写入 | RPC → action permission → service-role/RLS/ledger |
| F-0243 | 未编号 | 财务动作凭证 | proof issuance → command transaction consumption |
| F-0252 | 未编号 | 财务对账 | candidate selection → ambiguity → ledger/result |

## GX（38 个已枚举）

| 范围 | 首审对象族 | 第二轮最小入口 |
| --- | --- | --- |
| GX-0001 | 聚合 Jobs 控制面 | launcher/registry → producer → worker/retry/deadletter |
| GX-0002 | Auth owner-approved 旧登录实现 | current auth entry → compatibility adapter → session/permission |
| GX-0006–0012 | 平台/库存/全域/权益/财务历史迁移 | migration ledger → current schema/function → API/Worker consumer → rollback/retention |
| GX-0013–0020 | 渠道/客服/通知/报表/扩展/导入/Membership 迁移 | migration → owning module/worker → authority/retention |
| GX-0021–0024 | 微信支付/成员 scope/webhook/member audience | contract/route → authorization → database/event boundary |
| GX-0025–0028 | runtime contract/target-head/函数重绑 | checksum/ledger → startup/readiness/release gate |
| GX-0029–0036 | invitation/session/store/audit/Console 契约 | API/handler → RLS/audit/outbox → tests |
| GX-0037–0040 | Platform Owner 授权/Reporting Cockpit | permission grant → operation → read model/SQL/RLS |
| GX-0041 | 历史测试登录材料 | 文档 → current domain/account governance/rotation evidence；禁止尝试登录 |

## 未定位高风险差额（14）

历史累计报告 GX 52，但上表只能机械枚举 38 个 `GX-####` ID。以下 14 项当前没有唯一 ID/首审位置映射：**不可视为已复核、不可删除、不可降级。**

重建顺序：先从每个历史 AU 记录、候选累计变动与 F/GX 交叉引用回填唯一 ID，再分配第二轮审阅；如果证实是重复汇总或不再适用，也必须保留原始证据与裁决理由。

## G3

首轮累计为 0。最终收口前仍须确认没有被未定位 GX/G1 或历史清单掩盖的 G3 项。
