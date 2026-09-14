# AU-396｜分销渠道基础

`20260819160000_distributor_channel_foundation.sql` 建立分销商、分销商—租户关系及操作幂等账本；一个租户只有一个 active 分销归属。平台创建和挂载会同步组织层级，并以 critical 权限、平台范围、输入约束和审计保护。分销中心只返回聚合商城、订单与 GMV，不暴露成员或订单明细。

`20260820121000_canonical_distributor_scope_bindings.sql` 保留这些数据表并重定义分销权限判定与中心查询：active member、有效分销 anchor、租户关系和时间窗口都成为强制条件。因此数据模型、组织闭包和中心读取链为 G0。

固定基线未见初版 platform create/attach/list RPC 的应用或 Worker 调用，且核心合同使用另一套 `channel.distributor.*` 权限命名。它们仍是 service-role 公共写接口且涉及既有层级和租户归属，故归 DC-0059/G1，禁止删除。未发现 P0；未执行测试、数据库写入、构建或线上检查。
