# AU-352｜Supabase 成员运行时切换

`20260810110000_membership_runtime_cutover.sql` 将运行时权限收敛到成员角色，建立 provider/subject → member 的登录别名表，并以四个本地测试身份验证 storefront、商城管理员、企业管理员和平台业主的角色与范围模型；数据库不保存测试明文密码。

重定义后的 `api_resolve_membership_context` 只从活动、未过期的成员/成员身份/用户/商城关联推导 actor、角色、权限、范围和 authz 版本。订单与售后目标范围 RPC 则从数据库原始资源派生 tenant、企业、商城与用户，供资源地址型授权在请求体之前作决定。后续成员权限与范围迁移持续复用/重定义这些函数，归 G0。

未发现新增 P0–P3 或删除候选。未运行身份回填、登录别名写入或数据库授权验证。
