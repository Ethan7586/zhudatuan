# AU-383｜Supabase 通用 Storefront 访问

`20260817110000_universal_storefront_access.sql` 为每个新增的 active admin membership 自动创建同一人的独立 Storefront membership；该 membership 只带 self scope 与 employee 角色，不复制后台角色或广域 scope，并只补建零余额福利账户。迁移也回填既有管理员。该 after-insert trigger 仍是仓内唯一注册位置，因而不是可删除的历史文件。

本地凭据登录候选会返回同一成员的 active entrances，并按请求目标选择 membership；现行 API 登录仍直接调用该候选 RPC，且在本地密码校验后再解析 membership runtime。后续 fast-path 迁移仅扩展候选响应内的 runtime 投影，没有移除通用 Storefront access 的成员模型。

`api_member_entrances` 未见仓内应用调用，仍保留 service-role 公共 RPC 以及可能的外部成员入口选择责任，列为 G1、禁止删除；详见 DC-0052。未发现新增 P0–P3；未执行成员创建、登录、测试或数据库写入。
