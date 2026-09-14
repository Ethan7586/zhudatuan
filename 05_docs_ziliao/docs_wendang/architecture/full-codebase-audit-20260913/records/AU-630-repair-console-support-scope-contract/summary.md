# AU-630｜Repair Console Support Scope Contract

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260902133000_repair_console_support_scope_contract.sql`（40 行）。
- 审阅方式：逐行人工审阅 strict predecessor、role/function dependency、grant 与 assertion；交叉检查 ConsoleSupportRuntime 的启动 compatibility contract 和 support operation chain。未连接数据库、执行迁移或启动 Console。

## 审计结论

- **G0：保留。** 这是一个单目的 repair migration：为 Console Support runtime 补齐其确实在启动 compatibility contract 中要求的 `access.resolve_scope(text,text,text,text)` execute permission。
- [FACT][E-AU-630-001] migration 先要求 exact AU-629 ledger、无 future head、`shopconsole`/`zhudatuanconsoleapi` roles 和函数存在，随后仅授予 shopconsole 一条 function execute。
- [FACT][E-AU-630-002] ConsoleSupportRuntime 同时检查该 function 的存在和当前 role 的 execute privilege；support read/send 的运行路径经 AccessPipeline 使用 scope/membership 决策，不增加 support 表的直接读写授权。
- [FACT][E-AU-630-003] assertion 同时保证 public 没有 execute，故该 grant 未扩大到公开调用面。

## 关联问题

- **F-0266（P2）前置阻塞**：AU-630 的 strict predecessor chain 经过 AU-628；空库 runner 会先在 F-0266 处停下，未重复计入本单元。

## 未验证项

- 未以 `shopconsole` 真实连接执行 resolver 或启动 Console Support runtime；未验证已部署环境原先是否确实因缺此 grant 失败。

## 结论等级

- 新增问题：无；关联 F-0266。无 P0。
- 垃圾代码：G0 1 项（本 migration）；不新增 G1/G2/G3/GX。
- 二次复核：无需新增；F-0266 修复验证应一并覆盖 Console Support compatibility。
