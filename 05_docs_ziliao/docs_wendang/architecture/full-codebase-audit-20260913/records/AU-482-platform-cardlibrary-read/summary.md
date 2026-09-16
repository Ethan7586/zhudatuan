# AU-482｜平台 Owner 卡券库读取授权

- 主审 `20260821075000_grant_platform_cardlibrary_read.sql`（30 行），并人工反查 VoucherOperations、cardpool/allocation/card RLS 与 import worker；未执行迁移、数据库查询、卡券操作或线上验证。
- 迁移移除平台 Owner 的同项 deny，增加 active `voucher.cardlibrary.read` allow，并以实际 membership 的 `voucher.cardlibraries.read` capability 断言完成。它不增加卡券库写、分配、导入或兑换权限。
- 当前 read handler 返回 cardpool 元数据、allocation 摘要和有限 import error 摘要，要求 pool scope 或 allocation scope 可见。卡 code 本身以 ciphertext/fingerprint 保存；card RLS 还须经 cardpool/allocation scope。分配/导入路径另有 write permission、范围与 worker transaction 控制。
- **G0**：该 permission 映射是平台 Owner 可读取已发布 voucher card-library operation 的必要事实。**GX-0038**：卡券库存与高权限只读授权演进，禁止删除、改写、跳过或单独重放；需独立复核 current role permission、scope/allocation 跨租户反事实、字段脱敏与审计。未发现新增 P0–P3；未验证真实 RLS、卡密解密权限或线上 Console 输出。
