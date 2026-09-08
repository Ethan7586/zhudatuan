# 卡券凭证导入运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

实体卡号凭证导入的扫描、解密、指纹去重、KMS 加密、分片或错误文件异常时触发。Credential Pool 在完成前不可发放；明文落库/日志、重复 Credential、跨 Pool 分配或密钥不可用为 P0。

## Owner 与前置权限

Voucher Owner 主责，Security/KMS、Runtime 与 Finance 协同。先遵循 `import.md`；创建 `voucher.credentials.import` 需要 Step-up、目标 Pool ExpectedVersion 和批准的加密对象。操作人不能读取导入后的卡密明文。

## 只读诊断（Diagnosis）

除统一证据外，只读取 Pool/Batch、对象加密元数据、KMS Key 版本、接受/拒绝数、Blind Fingerprint 冲突、Ciphertext 存在性和分配状态；禁止输出源卡号、Ciphertext 或可逆指纹。确认对象在上传端已经加密且下载被阻断。

## 止血（Stop loss）

隔离对象并暂停对应 Pool 的新发放/导出，保留已成功加密且未分配 Credential。发现明文暴露立即按 `securityincident.md` 轮换 Key/撤销链接并保全证据；禁止手工插入卡号或重算生产指纹。

## 恢复（Recovery）

通用重试只处理原对象中未提交分片，使用稳定行键、Blind Fingerprint 和 KMS Key 版本幂等写入。永久格式/重复错误修正并重新加密源文件后新建任务；Key 故障恢复后继续原 Checkpoint，不降级为明文。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明每个 accepted 行恰有一个 Ciphertext、唯一 Fingerprint 和 KeyVersion，`total = accepted + rejected + duplicate`，无查询返回 Ciphertext/明文，Pool 可用数与未分配 Credential 一致。Data repair 仅前向元数据/投影修复；Escalation 对暴露/重复分配 P0；Audit 不保存明文。

## 回滚边界

未开始任务可取消；已安全写入 Credential 不删除，错误 Pool 通过受控迁移/作废处理。Key 轮换产生新版本，不恢复已撤销旧 Key；通用边界见 `import.md`。

## 沟通模板

“凭证导入 `{importId}`，Pool `{poolId}`，KeyVersion `{keyVersion}`，进度 `{completed}/{total}`，冲突 `{duplicates}`，安全状态 `{securityState}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

统一 Import 条件、加密/指纹/数量/Scope 核对通过；明文暴露为 0；Pool 状态与可用量正确；错误文件不含卡密；Security/KMS 签字完成。

## 复盘链接（Postmortem）

明文、Key 异常、重复指纹/分配、跨 Pool 或容量失效必须填写 `{postmortemUrl}`。
