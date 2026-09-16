# AU-374｜Supabase Storefront 会员资料

`20260813090000_storefront_member_profile.sql` 提供仅用于已认证 Storefront 用户自身资料的 service-role 投影：显示名、员工号、部门名和掩码手机号。RPC 以服务器传入的 tenant、enterprise、mall、user 组合验证 active 用户和商城归属，不读取浏览器提供的演示身份。

当前 account bootstrap 路由和账户资料测试均使用该 RPC；无法解析认证资料时该路由按 fail-closed 行为处理。该迁移仍是当前账户页资料来源的直接契约，归 G0。

未发现新增 P0–P3 或删除候选；未执行账户访问、测试或数据库写入。
