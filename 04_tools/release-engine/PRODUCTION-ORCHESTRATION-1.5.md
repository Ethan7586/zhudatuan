# Delivery Control 1.5 单次发布编排运行手册

状态：已接入 GitHub 自动封板与阿里云生产部署工作流；生产证据以每次运行回执为准。

## 一次触发合同

调用方先以最新 `origin/zdt-next` 创建 `ai.delivery.production-release-request.v1`。请求永久分开记录业务 `sourceSha` 与发布 `controlPlaneSha`，并包含组件闭包、物理节点、依赖图、重试/发布策略、actor、时间和幂等键。同一身份与策略产生相同幂等键。

本地候选编排器是 `src/production-orchestrator.mjs`。正式启用后，系统级入口只负责提交一个请求；组件写动作只能调用：

- `/Users/Ethan/.codex/bin/zdt-delivery prepare <target> <source-sha> <physical-node>`
- `/Users/Ethan/.codex/bin/zdt-delivery deploy <target> <source-sha> <physical-node>`

适配器会核对每次 canonical 命令实际解析的 `Delivery control: <sha>` 与请求中的 control-plane SHA；发生漂移即停止并创建新请求。旧 `deploy.yml`、`deploy-oss.yml`、`prepare-artifact.yml`、`deploy-prepared.yml` 不得成为入口。

## 自动流程

`REQUESTED → READINESS → PREPARING/RESUMING → SEALED → BUNDLE_READY → DEPLOYING → HEALTHY`

Doctor 不通过时没有 Prepare/Deploy 副作用。组件按显式 `dependsOn` 图分波次，同一波并行；每个组件先 reconcile。已 Seal 直接复用，可恢复状态只调用 canonical Prepare 并再次 exact readback，危险状态阻断。全部组件的 source、control、target、node、artifact digest、provenance 和 final Seal 一致后，写不可变 bundle gate receipt，并取得 Release Writer lease，才可调用 canonical Deploy。Deploy 后必须返回 current、previous、health 与 rollback evidence；一波失败时后续波次停止。

final Seal 到首次 Deploy 的间隙记录为 `sealToDeployGapMs`，本地合同上限 10 秒。该值明确标注 `localEvidenceOnly`，不能冒充生产 P95。

## 自动恢复与人工边界

- 408/429/5xx、DNS/连接瞬断：有限指数退避和 jitter。
- STS 过期：刷新短期凭据后重试同一精确操作。
- 写结果不确定：先 reconcile exact readback；已成功则复用，不重复写。
- 预算耗尽：`FAILED_RETRYABLE`，保留 checkpoint，同一幂等键重放。
- 403/ImplicitDeny、Secret 缺失、角色能力错误：`FAILED_BLOCKED`，不盲重试；修权限并重新通过 Doctor。
- 任一身份、digest 或 provenance 不一致：永久安全阻断。
- 活跃 Release Writer 冲突：等待权威 lease 结束，不绕过唯一写者。

## 失败 Closure 恢复

手动恢复必须提供 exact `head_sha/base_sha`，只恢复存在原 push Closure 失败证据的 source；base 必须是 source 祖先，source 必须属于当前 control lineage。closure artifact 绑定 exact Source SHA。deploy-source consumer 同时识别 push 和受控 workflow_dispatch，不把事件类型或绿色 Action 当作 Seal。

## 封板清单唯一权威

自动流程先产生不可部署的 v1 计划，再由阿里云 Release Runner 精确读取每个物理落点的 final Seal。所有目标均存在匹配的 source、artifact digest、control-plane SHA、Seal Key 和 final receipt 后，才生成可部署的 `zdt-automatic-artifact-closure/v2` 清单；缺少 final Seal 时整次 closure 失败。

如果 UPLOADED 与 VALIDATED 已完成、仅 final Seal 写入缺失，finalizer 只恢复该 Seal，不重建或重新上传制品。v2 清单记录每个目标的 exact Seal 身份和自身 digest；部署工作流校验整张清单后，把这些 exact 字段传给部署引擎。后续控制面升级不会改变既有版本绑定的 Seal 路径。

复用一个支持多个物理落点的制品时，每个落点都恢复独立的 UPLOADED 回执。历史 source 若已被某个落点当前运行的更新 source 包含，该落点仍完成候选验证与 final Seal，但部署阶段只验证当前健康状态，不移动指针、不重启、不回退；其他仍落后的落点照常前进。

## 第五批 Resume 与速度候选

每个自动准备目标先 exact 读取 release index 和本次 control-plane SHA 对应的 final Seal：全部落点已 Seal 时跳过 Prepare/Seal；制品存在但 final Seal 缺失时只运行 candidate validation 和 Seal 写入；制品不存在时才进入完整 Prepare。独立目标仍由 matrix 并行，依赖波次由 Closure 声明。

结构化 timeline 覆盖请求、Doctor、Runner 排队/路由、checkout/setup、依赖、build A/B、digest、upload、validation、final Seal、bundle gate、Seal-to-Deploy、Deploy、健康/回滚和用户总等待。预算保持 180s/60s/10s/一次人工触发。固定 fixture 中完整冷路径为 160.5s，exact sealed 快路径为 27.5s；该结果只证明候选阶段消除，不是生产 P95。

第五批不修改真实 Secrets/RAM/OIDC/OSS/Runner，不重放失败 source，不执行业务生产切换。真实生产综合分保持 56/100，等待第六批非空目标演练与多样本测量。
