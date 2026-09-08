# 商城入口与域名运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

自定义域名/TLS/Host→Mall 解析、`/s/{publicSlug}` 深链、二维码、Bootstrap、Publication Cache Head 或 CDN 入口异常时触发。单 Mall 入口失败为 P1；A Mall 解析到 B Mall、未发布/停用内容可读、Host/Session Scope 错配为 P0。

## Owner 与前置权限

Experience/Edge Owner 主责，Identity、Frontend、Security、CDN/DNS 与 Mall Owner 协同。域名绑定、证书和入口状态需要验证 Domain Ownership、Mall/Application ExpectedVersion、Step-up 和审批；所有 Origin 来自 `infrastructure/network/Edge.yml`，禁止临时 Resolver/第二真值。

## 只读诊断（Diagnosis）

核对 DNS、证书链/到期、SNI/Host、Edge Route、Domain→Mall/Application、PublicSlug 唯一、Published Release/Version/Pool、CDN Head/ETag、Cache Key/TTL、Storefront Session Mall、Bootstrap 和二维码解码。比较源站/Edge/构建配置 Hash，日志不含 Cookie/Token/PII。

## 止血（Stop loss）

跨 Mall 或 Scope 错配立即冻结受影响 Host，撤销 Session/缓存并保持其他域名；普通入口故障回指上一签名 CDN Head 或维护页。禁止把未知 Host 解析默认 Mall、开放未发布 Draft、全局清缓存或现场加兼容域名。

## 恢复（Recovery）

修复版本化 DNS/证书/Domain Binding 后先内部请求验证，再使用受控 Mall URL 执行页面、Bootstrap、绑定与独立二维码解码 Smoke；真实 iOS/Android 扫码核对地址、Mall、主题/Version 和 Pool。按 1/10/50/100 放量，每档核对入口失败、Session mismatch、发布/缓存一致性。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明 Host/PublicSlug 大小写唯一、每个 Application/Mall/Active Publication 关系合法、停用即时生效、A/B Mall 不串店、CDN Head/对象 Hash 一致、旧版可恢复。Data repair 只用 Domain/Experience Command；Escalation 跨 Mall P0；Audit 保存 DNS/Cert/Config/Smoke Hash 和放量签字。

## 回滚边界

可恢复上一签名 Edge 配置、证书、Domain Binding 版本和 CDN Head；数据库入口关系用新版本前向修复，不保留双解析。已完成交易不随入口回退。

## 沟通模板

“商城入口事件 `{incidentId}`，Host/Mall `{host}/{mallId}`，状态 `{entryState}`，用户影响 `{impact}`，当前 Head `{head}`，处置 `{containment}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

DNS/TLS/Host/Binding/Session/Bootstrap/二维码/Cache Head 全部通过；A/B Mall 隔离；停用/未发布策略正确；流量 100% 观察窗无告警；证据归档。

## 复盘链接（Postmortem）

跨 Mall、未发布泄露、证书中断、二维码错店、缓存旧 Head 或入口 SLO 违约必须填写 `{postmortemUrl}`。
