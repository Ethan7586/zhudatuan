# AU-610｜运行时 Digest 授权

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260830102000_grant_runtime_digest.sql`（23 行）。
- 审阅方式：逐行人工审阅 schema/function ACL 与 assertion；交叉检查数据库中 `public.digest(text,text)` 的 canonical JSON/hash consumers 和 API/Job 运行角色。未连接数据库或执行迁移。

## 审计结论

- **G0：保留。** `shopapp` 与 `shopjob` 需要 `public.digest(text,text)` 为 provider-effect、idempotency 与其它受控数据库写入计算确定性摘要；该 migration 不是无用 privilege 放宽。
- [FACT][E-AU-610-001] 仅授予 public schema usage 和单一 text/text overload execute，同时撤销 public execute；没有授权整个 `pgcrypto` surface 或 digest 的其它 overload。
- [FACT][E-AU-610-002] assertion 要求两个运行角色均具 schema usage/精确 execute，防止遗漏导致 API/Worker 在持久化 hash 约束时运行失败。
- [FACT][E-AU-610-003] 数据库迁移、session/identity、channel、policy 与测试中均存在 `public.digest(text,text)` 的 canonical hashing；本项的真实风险是权限缺失导致受控写路径失败，而非读取或密钥暴露。

## 未验证项

- 未以 shopapp/shopjob 实际登录验证 function ACL、provider-effect constraints 或其 RLS 上下文；该小 migration 同样缺少 predecessor/head guard，作为 F-0263 已记录模式交叉关联，不重复计数。

## 结论等级

- 新增问题：无（F-0263 交叉关联）。无 P0。
- 垃圾代码：G0 1 项（本迁移）；不新增 G1/G2/G3/GX。
- 二次复核：无需；任何后续 digest role grant 应固定 overload 并保留 public-deny 反事实检查。
