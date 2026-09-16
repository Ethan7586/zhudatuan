# AU-161｜Support case/message 写入链深审

Console Support 入口将 KMS、repository 和 order summary 注入同一 operation route。case create 创建工单、SLA job 和可选 encrypted message；message send 以 expected version 锁定并更新状态。F-0185/P2 记录 write side-effect test 缺口。未发现 P0。
