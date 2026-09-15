# 发布控制面 1.4.3

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

普通写操作只派发 `delivery-1-4-3.yml`。Prepare、候选验证、Seal、单目标 Deploy 和 sealed-source Deploy 均为 `workflow_call` 子工作流，不是用户入口。自动封板只由 `zdt-next` push 触发，不接受手工派发，也不部署生产。

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
| 用户可见控制面 | `1.4.3` |
| Seal Key 序列化 | `zdt-seal-key/v1` |
| Seal Key Schema | `ai.delivery.seal-key.v1` |
| Final Seal receipt | `ai.delivery.final-seal.v1` |
| Runner request / lease | `ai.delivery.runner-request.v1` / `ai.delivery.runner-lease.v1` |
| Release Writer request / lease | `ai.delivery.release-writer-request.v1` / `ai.delivery.release-writer-lease.v1` |
| 状态输出 | `zdt-delivery-status/v2` |

Schema 只在字段出现不兼容变化时升级；产品版本升级不改写已稳定的 v1 身份协议。

## 安全边界

Deploy 只消费 OSS 最终 Seal，不构建、不安装依赖、不准备缺失制品。Release Writer Lease 是唯一写者权威，远端目标锁是第二层互斥。数据库迁移保持 forward-only。缺少完整 source SHA、真实物理目标、最终 Seal 或一致生产事实时停止。

灾难恢复不属于普通 1.4.3 路径，见 [RECOVERY.md](RECOVERY.md)。
