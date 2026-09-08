# 客服附件扫描运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

附件扫描超时/失败、MIME/Magic/Hash 改变、恶意文件、解压炸弹、对象越权或 Job Deadletter 时触发。附件保持隔离不可下载；恶意内容已下载或跨 Scope 暴露为 P0。

## Owner 与前置权限

Support Owner 主责，Security、Object Storage 与 Runtime 协同。扫描服务只访问隔离前缀和最小对象元数据；人工审查需双人授权、隔离环境和 Legal Hold。用户/客服不能绕过扫描状态。

## 只读诊断（Diagnosis）

核对上传 Receipt、服务器生成对象名、Scope、Size、MIME、Magic、Extension、SHA-256、图片/压缩包限制、Scanner/Signature Version、扫描状态、下载策略和 Job Checkpoint。不得在本机打开可疑文件或记录正文。

## 止血（Stop loss）

保持对象 private/quarantined，撤销所有签名 URL，暂停该 Hash 的重试并隔离扫描器；其他干净附件继续。发现下载/逃逸进入 `securityincident.md`，保全对象版本和访问日志。

## 恢复（Recovery）

恢复扫描依赖后以同 EvidenceId/Object Hash 重试；Hash 改变必须新上传。只有 clean 结果、元数据未变、Scope 授权通过才允许短时一次性下载；rejected 永不自动转 clean。永久错误提示中文安全恢复动作。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明对象 Hash/元数据/扫描版本一致、未扫描和 rejected 下载成功数为 0、签名 URL 短时且 Scope 正确、访问已审计。Data repair 只新上传；Escalation 恶意逃逸 P0；Audit 保存 Hash/分类/回执不保存正文。

## 回滚边界

Clean 状态若签名库更新可前向改 quarantined，不能删除历史扫描；撤销 URL 不恢复。恶意对象按保留/Legal 决策隔离或销毁。

## 沟通模板

“附件事件 `{incidentId}`，Evidence `{evidenceId}`，扫描状态 `{state}`，用户影响 `{impact}`，隔离措施 `{containment}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

所有对象状态明确；未扫描/恶意下载为 0；Scope/Hash/扫描/URL/访问核对通过；必要安全通知完成；告警恢复。

## 复盘链接（Postmortem）

恶意逃逸、跨 Scope、Hash 改变漏检、扫描器供应链问题或 SLO 违约必须填写 `{postmortemUrl}`。
