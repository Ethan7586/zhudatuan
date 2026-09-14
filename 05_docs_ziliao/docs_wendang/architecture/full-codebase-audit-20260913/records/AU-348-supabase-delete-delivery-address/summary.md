# AU-348｜Supabase 删除收货地址

`20260726110000_delete_delivery_address.sql` 提供仅 `service_role` 可执行的地址删除 RPC。空 ID 被显式拒绝；删除条件完整限制至 tenant、企业、商城、用户和地址 ID，成功后追加删除审计事实，未命中则返回 false。

当前 Storefront 地址路由在身份权限检查后实际调用该 RPC，并把未命中规范映射为 404。它承担用户可观察的地址簿删除职责，归 G0。

未发现新增 P0–P3 或删除候选。未执行地址删除或数据库迁移。
