# 安全事件运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

跨 Scope 访问、Secret/Token/卡密暴露、PII 进入日志或遥测、异常会话、签名/审计 Hash 失败、恶意附件逃逸或供应链校验失败时触发。已确认泄露、越权写、证据破坏或生产凭据失控为 P0；被控制阻断且无数据外泄证据为 P1。用户可能受到隐私暴露、账户接管、交易误操作或服务受限影响。

## Owner 与前置权限

Security Incident Commander 主责，Identity、Privacy、Reliability、Legal、Communications 与受影响领域 Owner 协同。必须使用独立 Breakglass 身份、MFA、短时租约、双人审批和全量审计；调查权限按 Scope 与数据类别最小化。Secret 值、完整 PII、卡密、Cookie 与请求正文不得出现在工单、聊天或命令参数中。

## 只读诊断（Diagnosis）

以 `{incidentId}`、时间窗、Release、配置/Manifest Hash、Trace Exemplar、Actor、Membership、Scope 和 Operation 建立证据清单。读取授权决定、会话设备、凭据版本元数据、审计 Hash 链、对象访问日志、遥测清洗失败、Provider 外呼、发布证据和数据库只读快照。先确定事件边界和权威事实，不在原始证据上试验查询，不向外部系统发送可疑内容。

## 止血（Stop loss）

按最小影响范围撤销会话、Proof、签名 URL、工作负载身份与 Secret 租约；冻结受影响 Operation、Provider 连接、对象前缀或发布 Head，保留其他健康能力。轮换时先建立新版本并验证消费者，再撤销旧版本；不得把 Secret 值写入环境输出。隔离可疑附件、日志出口和制品，启动 Legal Hold，保存原始时间、Hash、访问日志和审批链。

## 恢复（Recovery）

修复授权/清洗/签名/依赖后，以新版本配置、Secret 或制品 Canary 恢复。会话按 `sessioncompromise.md` 撤销并要求重新认证；PII 按 `privacydeletion.md` 处理；供应链重新生成 SBOM、签名和来源证明；业务写入先只读核验再分 Scope 放量。任何已发生的支付、核销、分录、发放和审批仅可领域补偿或冲正。

## 数据核对（Data repair / Validation / Escalation / Audit）

验证跨 Scope 读取/写入均被拒绝；所有受影响会话、Proof、租约和 Secret 旧版本失效；日志、指标、Trace、对象与导出不再包含敏感原文；审计 Hash 链连续；订单、支付、库存、账本、凭证和 Outbox/Inbox 无重复或缺失。记录受影响主体数量、数据类别、时间边界、Hash、轮换版本和通知决定，不复制敏感内容。

## 回滚边界

可回退未生效的配置和未切流制品；已撤销的 Secret、会话和签名 URL不得重新启用，必须发行新版本。已删除/去标识化的 PII 不从生产备份原地恢复；历史审计证据不可改写。Retire 后只允许前向安全修复。

## 沟通模板

“安全事件 `{incidentId}`，严重级 `{severity}`，确认影响 `{impact}`，涉及 Scope/数据类 `{scopeAndClass}`，已完成止血 `{containment}`，用户/监管通知决定 `{notificationDecision}`，下一更新时间 `{nextUpdate}`，Incident Commander `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

攻击/泄露路径关闭；受影响身份和凭据全部撤销或轮换；权限、Scope、清洗、签名与业务不变量验证通过；所需客户、合作方和监管通知完成；观察窗无新信号；证据已不可变归档，补救 Owner 与截止时间明确。

## 复盘链接（Postmortem）

所有 P0/P1 安全事件必须建立 `{postmortemUrl}`，包含时间线、攻击/失效路径、数据与用户影响、检测和响应差距、通知依据、永久修复、验证证据及跟踪日期。
