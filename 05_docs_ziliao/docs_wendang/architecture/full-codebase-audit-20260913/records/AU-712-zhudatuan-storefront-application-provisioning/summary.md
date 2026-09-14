# AU-712｜主打团 Storefront Application Provisioning

- 审阅范围：`20260905203000_provision_zhudatuan_storefront_application.sql`、Identity registration/application resolution、Storefront/Web runtime manifest references。
- 审阅方式：深入审阅 application→version→binding→release写入关系及认证/运行 caller；同构 manifest与测试引用作结构性审阅。

## 审计结论

- **G0：保留。** 该 migration创建 `application:mall-zhudatuan`、其 immutable v1 configuration、Mall/pool binding和 active release；`zhudatuan-storefront` slug被 Identity registration、password/WeChat flows、auth-web和Storefront runtime真实使用。
- [FACT][E-AU-712-001] registration先通过 Storefront application解析 authoritative organization/terms及 realm target，再创建 membership；错误删除或改写该 seed会破坏 L0 consumer login/registration和 storefront domain binding。
- [FACT][E-AU-712-002] 后续 node manifest使用 shared storefront execution application，不等于删除此 Experience application：前者是部署运行单元，后者是 Mall 的数据/体验绑定。
- 本模块没有新增独立问题。

## 未验证项

- 未读取生产 application/version/binding/release数据或实际 domain routing；未运行完整 Experience/Identity integration suite。

## 结论等级

- 新增问题：无。无 P0。
- 垃圾代码：G0 1 项；不新增 G1/G2/G3/GX。
- 二次复核：不要求新增独立复核；若替换 Storefront experience app，必须验证 application slug、Mall/pool binding、active release、L0/L1 realm resolution、登录/注册 return target和回滚版本。
