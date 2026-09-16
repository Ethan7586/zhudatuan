# AU-368｜Supabase 会员身份保障

`20260812260000_member_identity_assurance.sql` 将身份保障与业务授权分离：成员插入和手机号别名变化同步维护 assurance 事实，`api_member_assurance` 暴露账号/手机号验证级别，`api_member_phone_verified` 以 membership 与用户的真实关联验证支付资格。订单创建与内部支付的授权包装器在写入前要求手机号已验证，并撤回 service-role 对未加保护原始写 RPC 的执行权。

Commerce API 的订单和内部支付入口仍读取 assurance 并调用受保护写路径；会话安全中心同时展示 assurance 状态。后续订单/库存/支付迁移更新订单包装实现，但保留 assurance 表、同步触发器、资格断言和原始 RPC 撤权这条前置链。

结论为 G0：会员身份保障、支付资格和会话展示职责。未发现新增 P0–P3 或删除候选；未执行订单、支付、会话或数据库写入。
