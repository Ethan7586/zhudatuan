# AU-664｜Identity Node Profiles

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260907123000_enforce_identity_node_profiles.sql`（90 行）。
- 审阅方式：逐段人工审阅 Realm、target、membership 的 node profile 约束与初始回填；反向检查 Realm resolver、registration 与 member node consumer、后续 autonomous/hosted Realm provisioning 的写入形状。未执行数据库或生产节点查询。

## 审计结论

- **G0：保留。** 该 migration 是 operating Mall 与 consumer node 两种身份 Realm 拓扑的数据库边界，不是重复字段或无用兼容层。
- [FACT][E-AU-664-001] Realm shape 限制 operating Mall 必须拥有 Mall 且不依附 host；consumer 必须依附不同的 operating Mall host 且无 Mall。复合外键防止 consumer host 指向错误 profile。
- [FACT][E-AU-664-002] target 与 membership 分别以 `(realm_id,node_profile)` 绑定 Realm；consumer profile 只允许 consumer surface/Storefront target 和 Storefront membership，防止 operator/store/supplier 身份被写进 consumer Realm。
- [FACT][E-AU-664-003] `RealmAccount`/session resolver 输出 node profile，registration 写入也要求 membership 与 Realm profile 相同；后续 hosted/autonomous Realm provisioning 均按本迁移定义的 shape 创建或恢复记录。

## 未验证项

- 未复放 consumer Realm 创建/升级/降级迁移链，无法确认现存历史节点是否均已通过该 shape 约束。
- 未运行实际 node profile 拓扑下的登录、Storefront 注册和授权请求。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Identity node profile schema boundary）；不新增 G1/G2/G3/GX。
- 二次复核：否。
