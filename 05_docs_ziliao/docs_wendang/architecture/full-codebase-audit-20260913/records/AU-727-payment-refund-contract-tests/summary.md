# AU-727｜支付退款数据库合同测试

- 审阅范围：after-sale refund approval、internal tender closure 与 WeChat refund request/command/event/notification/terminal 的 7 份 SQL 合同。
- 审阅方式：深入审阅退款授权证据、MFA step-up、状态机拒绝、幂等冲突、支付/财务落账、worker claim、死信和终态回退；同构建模/夹具断言结构性审阅。未运行 SQL，避免审计写库。

## 审计结论

- **G0：全部保留。** 文件分工不是重复：approval 保存售后审查前置条件；internal closure 保存复合内部资金不得猜测分摊；WeChat 文件分别覆盖请求、命令、事件、通知和终态/死信。
- 代表性契约均以动态 ID、显式异常预期和 `begin`/`rollback` 隔离；会验证拒绝路径未遗留退款命令或财务状态，避免只验证成功流程。
- 未发现新增问题。未验证：固定基线内没有定位到这些独立 SQL 的正式 runner；因此没有把执行器存在或当前 migration head 可运行写成事实。
