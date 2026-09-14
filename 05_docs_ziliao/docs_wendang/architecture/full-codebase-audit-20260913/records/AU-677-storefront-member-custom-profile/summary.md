# AU-677｜Storefront Member Custom Profile

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260911010000_add_storefront_member_custom_profile.sql`（61 行）。
- 审阅方式：逐段人工审阅 custom tag/field/value schema、RLS、operation publication；反向检查 MemberCustomProfileOperations 的 target validation、字段值验证、Mall isolation PGlite test。未执行服务或生产数据库。

## 审计结论

- **G0：保留。** migration 为 Mall-scoped Storefront member 的标签与动态字段建立数据模型和 operator API contract；自定义值不包含身份明文，系统标签从当前 membership/profile/order/referral facts 投影。
- [FACT][E-AU-677-001] 四张表以 organization-scoped composite key 关联 tag/field definition，RLS 对 shopapp 强制 `app.scope_id` 匹配；membership 删除会 cascade 清除其 custom value/assignment。
- [FACT][E-AU-677-002] 虽然 schema 的 membership foreign key 不包含 organization，运行 `saveProfile` 和 read path 都先要求 membership 的 `organization_id=$scope` 且 client=storefront；然后所有 assignment/value 读写使用相同 scope，阻止 API 通过跨 Mall membership id 写入。
- [FACT][E-AU-677-003] PGlite test 覆盖七种 field type、Mall two 的配置/读取隔离和 cross-Mall membership read 拒绝；写入只接受 enabled definitions与符合 type/options 的值。

## 未验证项

- 未以原始 shopapp 数据库连接绕开 application target validation；RLS 只能限制 organization scope，不能代替业务层的 membership/organization relationship check。
- 未验证 config 删除 enabled field/tag 后历史 assignment/value 的实际 cascade/保留语义。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（Storefront member custom profile schema/API publication）；不新增 G1/G2/G3/GX。
- 二次复核：否。
