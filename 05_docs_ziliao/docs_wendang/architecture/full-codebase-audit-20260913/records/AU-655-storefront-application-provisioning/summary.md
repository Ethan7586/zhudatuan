# AU-655｜Provision Zhudatuan Storefront Application

- 审阅范围：`02_platform_pingtai/database/supabase/migrations/20260905203000_provision_zhudatuan_storefront_application.sql`（57 行）。
- 审阅方式：逐段人工审阅 application/version/binding/release 的 data topology；交叉检查 MemberPort Storefront registration resolver、Identity registration/session paths、node manifests 和 application consumer。未执行数据库或启动服务。

## 审计结论

- **G0：保留。** migration 建立 canonical Mall 的 active Storefront application、首个 valid configuration version、domain binding、catalog pool binding以及 active release；这是身份注册与 Storefront runtime 的真实数据前置。
- [FACT][E-AU-655-001] `MemberPort.storefrontRegistration` 以 public slug 连接 active application、同-domain binding、active Mall、active 商城会员 role、有效 registration policy 与 active release；返回的 application/Mall/role/terms 直接决定注册路径。
- [FACT][E-AU-655-002] Identity registration 先以该 application slug 解析 realm，并验证 realm membership organization 等于 binding Mall 后才设置 transaction-local registration Mall；Session ticket consumer也重复 application slug/Mall 一致性检查。
- [FACT][E-AU-655-003] `zhudatuan-l0` node manifest 的多种 Storefront domain binding 均引用 `application:mall-zhudatuan`；Web Business runtime会检查其 active manifest application set 与 Storefront binding 的闭环。

## 未验证项

- 未在隔离数据库从零执行该 migration，未验证 experience schema 的唯一性/foreign-key和 release timeline。
- 未通过真实 public domain 发起注册或页面渲染；只核验仓内注册、session、manifest的数据流。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项（本 migration；canonical application seed，不是可删除示例数据）。
- 二次复核：否。
