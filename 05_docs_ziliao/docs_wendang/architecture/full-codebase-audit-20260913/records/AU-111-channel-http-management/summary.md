# AU-111｜Channel HTTP 管理与 Capability quota 调用深审

ChannelRoutes 汇集 distributor、tenant binding、quota 和 provider operation replay。distributor/binding 通过 organization closure 限定当前 scope；quota 委托 CapabilityPort，复用其 scope/version guarded entitlement 写入；replay 只重排 failed/unknown operation 并按类型投递 refund 或 fulfillment job。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行；现有测试仅锁定 manifest 目录。
