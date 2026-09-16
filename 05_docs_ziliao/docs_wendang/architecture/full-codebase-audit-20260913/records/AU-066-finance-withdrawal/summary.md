# AU-066｜finance 提现申请、审批与恢复深审

- 本单元覆盖 partner settlement withdrawal 的创建、四眼审批、withdrawal deadletter 后恢复，以及 FinanceRepository 的稳定 job 入队语义。
- 创建要求 settlement payable、scope/version 一致且未完成 withdrawal 总额仍有余额；批准要求 submitted、同 scope/version 和 requester/approver 分离，批准后以稳定 job id 入队。恢复只允许 uncertain/failed，referral uncertain 直接回 processing，其他回 approved，带审计 evidence 并以 replay=true 仅重开 failed job。
- 当前测试只覆盖 uncertain referral recovery；缺少 create/decide 的余额、并发、四眼、stable job 与非-referral 恢复行为验证。新增 F-0153/P2。固定审计 worktree 无 vitest 可执行文件，未安装依赖；未发现 P0/P1。
