# 发布控制面 1.5

状态：ACTIVE

用户与普通 Codex 任务只使用系统入口：

```text
/Users/Ethan/.codex/bin/zdt-delivery status <target> <full-source-sha> <physical-node>
/Users/Ethan/.codex/bin/zdt-delivery status <target> <full-source-sha> <physical-node> --json
/Users/Ethan/.codex/bin/zdt-delivery prepare <target> <full-source-sha> <physical-node>
/Users/Ethan/.codex/bin/zdt-delivery deploy <target> <full-source-sha> <physical-node>
/Users/Ethan/.codex/bin/zdt-delivery deploy-source <full-source-sha>
```

`deploy` 只处理一个已经封板的物理目标；`deploy-source` 只消费该 source 的自动封板清单，并按既定波次部署其中全部目标。系统入口始终获取最新 `origin/zdt-next` 作为 control-plane SHA，业务 source SHA 与控制面 SHA 分开保存。

普通写操作只派发兼容文件名 `delivery-1-4-3.yml`，其机器名称和行为版本为 Delivery Control 1.5。Prepare、候选验证、Seal、单目标 Deploy 和 sealed-source Deploy 均为 `workflow_call` 子工作流，不是用户入口。自动封板由 `zdt-next` push 触发；手工派发只恢复存在失败 push 证据的 exact source/base，不部署生产。

## 权威状态

`status` 是严格只读查询。判定顺序为：

1. OSS Seal 生命周期与精确 `final-seal.json`；
2. 远端 `candidate-seal.json`；
3. 生产 `current` 与 `previous` 指针及其制品清单；
4. OSS Release Writer Lease；
5. GitHub Actions 仅作为最近任务链接，不参与状态结论。

返回状态为 `NOT_PREPARED / BUILDING / UPLOADED / VALIDATED / SEALED / DEPLOYED / FAILED / UNKNOWN`。只有 current 精确匹配最终 Seal 才是 `DEPLOYED`；previous 只展示回滚事实。OSS、远端 Seal 或 current 冲突时返回 `FAILED`，权威事实不可读时返回 `UNKNOWN` 或在 JSON 中标明 `PARTIAL`。

默认是简短中文输出；追加 `--json` 返回 `zdt-delivery-status/v2`。

## 版本与 Schema

| 语义 | 当前值 |
| --- | --- |
| 用户可见控制面 | `1.5` |
| 自动 Closure | `zdt-automatic-artifact-closure/v2` |
| Seal Key 序列化 | `zdt-seal-key/v1` |
| Seal Key Schema | `ai.delivery.seal-key.v1` |
| Final Seal receipt | `ai.delivery.final-seal.v1` |
| Runner request / lease | `ai.delivery.runner-request.v1` / `ai.delivery.runner-lease.v1` |
| Release Writer request / lease | `ai.delivery.release-writer-request.v1` / `ai.delivery.release-writer-lease.v1` |
| 状态输出 | `zdt-delivery-status/v2` |

Schema 只在字段出现不兼容变化时升级；产品版本升级不改写已稳定的 v1 身份协议。

### 1.4.2 一次性兼容策略

1.4.2 制品与历史回执保持只读。它们可以用于摘要核对和生产 current/previous 取证，但不能直接进入 1.5 候选验证、不能自动生成新 Seal，也不能因旧 Action 成功而升级。需要迁移的目标必须走一次正常 1.5 Prepare：在 Build 侧冷构建并与已有不可变对象核对，相同对象只幂等复用，随后用当前 control-plane SHA 完成候选验证和新 final Seal。Deploy 现场不重建、不修改旧 artifact；任一步失败都不移动现有 1.4.2 current。

### 生产综合评分

本地 62 项故障演练只计算候选可靠性，不代表生产综合分。生产综合量表固定为 100 分：可靠性 60、速度 20、生产成熟度 20。速度证据必须记录请求、排队、Prepare、双冷构建或复用、上传、验证、final Seal、Seal 到 Deploy、Deploy 和生产健康；Storefront 新源码到健康 P95 不超过 180 秒、已有封板制品到健康 P95 不超过 60 秒、Seal 到 Deploy 自动衔接 P95 不超过 10 秒、人工触发最多一次。单次生产演练只能标记为单次样本，不得声称 P95 成立；没有生产证据时不得用夹具分代替综合分。

## 安全边界

Deploy 只消费 OSS 最终 Seal，不构建、不安装依赖、不准备缺失制品。Release Writer Lease 是唯一写者权威，远端目标锁是第二层互斥。数据库迁移保持 forward-only。缺少完整 source SHA、真实物理目标、最终 Seal 或一致生产事实时停止。

灾难恢复不属于普通 1.5 路径，见 [RECOVERY.md](RECOVERY.md)。

第五批把 1.5 finalizer、Resume 决策和 Closure-bound Seal proof 接入正式 workflow；在真实非空目标演练、故障重放和多样本速度测量完成前，生产综合分保持 56/100。候选合同与 OSS 最小权限审计见 `04_tools/release-engine/READINESS-1.5.md`。
