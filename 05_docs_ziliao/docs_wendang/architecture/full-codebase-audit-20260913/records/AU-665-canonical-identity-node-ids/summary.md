# AU-665｜Canonical Identity Node IDs

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260908010000_canonicalize_sfl_identity_node_ids.sql`（68 行）。
- 审阅方式：结构性审阅。逐项比对 AU-664 Realm profile/host foreign key 的变更差异、node-id 规范、下游 node registry/runtime/test 引用；未重复深读已在 AU-664 审阅的 profile schema 逻辑，未执行迁移。

## 审计结论

- **G0：保留。** 这是已审 Realm topology 的标识符规范化，不引入新的写模型、授权能力或运行入口。
- [FACT][E-AU-665-001] migration 只将初始 `l0`/`l1` Realm 与其 host reference 改为 `node:zhudatuan:l0`/`node:hbbtzn:l1`，重建 consumer host 外键并收紧 node-id 格式；断言拒绝旧值残留。
- [FACT][E-AU-665-002] 当前 node manifest、Identity runtime、auth web、SDK 与数据库 contract fixtures 均使用规范化 node id，调用链与迁移目标一致。

## 未验证项

- 未在含第三方/历史 consumer Realm 的数据库副本上复放；未验证该时点是否存在 source guard 未覆盖的额外 Realm（迁移以 source registry 只有两个 Realm 为前提）。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（历史 node-id canonicalization）；不新增 G1/G2/G3/GX。
- 二次复核：否。
