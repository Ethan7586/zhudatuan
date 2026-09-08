# 商城装修发布运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

商城、团购、政企三主题的草稿保存/校验/预览/发布停滞，CDN/Object Hash 不一致、Publication Head 未切换、多端渲染漂移或恢复失败时触发。旧发布版本应继续服务；跨 Mall、错误 Head、对象篡改或未校验内容上线为 P0。

## Owner 与前置权限

Experience Owner 主责，Frontend、Object/CDN、Catalog、Security 与 Runtime 协同。发布人需目标 Mall/Application 权限、Step-up、ExpectedVersion、校验收据和不可变候选 Manifest；恢复历史版本同样走审批/发布路径。不得直接写 CDN Head。

## 只读诊断（Diagnosis）

核对 Application/Mall、Theme（shop/market/governance）、Draft、ExperienceVersion、组件 Schema 版本、Validation Issue 定位、Preview Manifest、Publication/Release、对象 Key/Hash、CDN Cache Head、Job/Inbox 和 auth/console/storefront/miniapp/store/supplier 渲染证据。预览和发布必须引用同一 Manifest Hash。

## 止血（Stop loss）

暂停该 Application 新发布，保持旧 Head 与旧对象可读；不影响其他 Mall。Hash 冲突或跨 Mall 对象立即隔离并进入安全事件。禁止覆盖 Content-addressed Object、手改 Publication、清全站缓存或把 Preview URL 当发布结果。

## 恢复（Recovery）

对象/CDN/数据库瞬时故障修复后，以原 ReleaseId/VersionId/Manifest Hash 幂等重试；全部对象上传并逐项校验后原子切 Head。功能恢复选择历史不可变版本，复制为新 ExperienceVersion，重新校验、预览、发布，不修改历史。CDN 失败保留旧 Head。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明 Draft/Version 隔离、Preview=Publish Manifest、Application Head/Publication/Object/CDN ETag/Hash 一致，三主题在 Desktop/Tablet/Mobile/Miniapp 无裁切，旧版可用。Data repair 只补缺失任务/引用或新版本；Escalation Hash/跨 Mall P0；Audit 保存 Actor/Approval/前后 Head/Hash/Trace。

## 回滚边界

Head 切换前可取消；切换后可把历史版本复制为新版本并重新发布，不能改/删历史 Publication。已发生交易不随页面版本回滚；对象与证据按保留策略不可变。

## 沟通模板

“装修发布 `{releaseId}`，Application/Mall `{applicationId}/{mallId}`，主题 `{theme}`，状态 `{stage}`，旧 Head `{previousHead}`，用户影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

同一 Manifest 的校验/预览/发布通过；Head/Object/CDN/缓存一致；三主题和四类断点验收；旧版保活；跨 Mall/Hash 异常为 0；告警与证据关闭。

## 复盘链接（Postmortem）

旧版失活、Hash 冲突、跨 Mall、未校验发布、多端裁切或发布 SLO 违约必须填写 `{postmortemUrl}`。
