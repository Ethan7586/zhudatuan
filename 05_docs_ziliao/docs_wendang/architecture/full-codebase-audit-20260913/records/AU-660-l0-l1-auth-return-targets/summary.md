# AU-660｜Separate L0/L1 Auth Return Targets

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260907113000_separate_l0_l1_auth_return_targets.sql`（44 行）。
- 审阅方式：逐段人工审阅 authticket target constraint；反向检查 AuthTarget type、HTTP target parser、realm resolver、registration/WeChat/session ticket flows、node config与拒绝测试。未执行数据库或登录。

## 审计结论

- **G0：保留 migration 记录，关联 F-0274。** migration 是已执行的 schema contract；其加入的 L1 专用 values 与当前应用层 AuthTarget 契约不一致，不能作为完成实现处理。
- [FACT][E-AU-660-001] database constraint 允许 `console-hbbtzn` 与 `storefront-hbbtzn`；其余代码链将 target 写入/读取 identity realm 与 auth ticket。
- **F-0274（P2，新增）**：config 的 `AuthTarget` union 和 `authTarget()` 解析器仅接受 console/storefront/store/supplier，拒绝两个 migration 新值。Registration 与 WeChat JSAPI 均先调用该 parser，随后又要求 requested target 与 realm application target 精确一致，因此无法建立 L1 专用 target 的票据回跳。
- [FACT][E-AU-660-002] tests 已覆盖 L0 target 对 L1 application 的拒绝，说明两层 realm target 分离是实际安全意图；但没有成功的 `*-hbbtzn` roundtrip contract。

## 未验证项

- 未读取生产 `identity.realmtarget`，未知是否已有专用 target 数据。
- 未经真实 HTTP/DB 进行 ticket issue/exchange；结论来自 type、parser、resolver与 operation call-chain 的静态执行逻辑。

## 结论等级

- 新增问题：P2 1 项（F-0274）。无 P0。
- 垃圾代码：G0 1 项（历史 schema migration）；不新增 G1/G2/G3/GX。
- 二次复核：否；修复前应确认哪些 L1 entry host/return origins需要独立 target，而非仅扩展 parser。
