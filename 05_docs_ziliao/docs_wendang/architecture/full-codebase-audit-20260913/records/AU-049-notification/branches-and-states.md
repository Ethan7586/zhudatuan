# AU-049 状态与失败路径

| 阶段 | 正常状态变化 | 已核对失败路径 | 风险/恢复 |
| --- | --- | --- | --- |
| 事件入队 | inbox → dispatch queued + runtime.job queued | scope/模板/变量/KMS 加密异常会中断事件处理 | inbox 不 complete，可由通用 job retry 重试 |
| 领取投递 | dispatch queued/failed → sending | KMS 解密、Template 构造在 `send` try/catch 之前 | F-0143：dispatch 不回 failed；后续 job 空领取后 completed |
| 外部发送 | sending → sent + attempt + notification.delivered | 渠道异常调用 fail，dispatch → failed | JobRunner 退避重试，最长 8 次后 runtime.deadletter；dispatch 本身没有对应 terminal 标记 |
| 身份验证码 | identity challenge 独立 sending/sent/ambiguous | 不确定 provider outcome 写 ambiguous 并创建告警 | 已有专用恢复语义；不能推导一般 notification dispatch 有同等恢复 |
