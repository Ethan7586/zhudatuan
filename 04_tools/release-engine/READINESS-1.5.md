# Delivery Control 1.5 readiness contract

状态：第一批本地候选。现役生产控制面仍由根目录 `AI-DELIVERY.md` 声明。

`node 04_tools/release-engine/cli.mjs doctor --source-sha <sha> --control-sha <sha> --target <target> --node <physical-node> --repository Ethan7586/zhudatuan --format json`
只执行读取与静态检查，输出 `ai.delivery.readiness-doctor.v1`。它不修改 Secret、RAM、Runner 或 OSS，不创建 Seal/Lease，不触发 Prepare/Deploy，不移动生产指针。

失败 Closure 的 Resume 还必须提供 `--base-sha <exact-ancestor>`。Doctor 同时证明：历史上存在该 source 的失败自动封板、base 是 source 的祖先、source 是最新控制面的祖先。自动封板手动重放复用同一个工作流和同一份 Closure schema；deploy-source 通过精确 artifact 名称识别 push 或手动恢复运行，不把工作流事件类型当作制品权威。

## 真实失败基线

- Run `35006316266`：历史 Secret 调用链缺口；后续 Run 已越过该阶段，因此不是当前唯一根因。
- Run `35022406367`：`runner-selection` 的 `OSS_LIST_FAILED / HTTP 403`。证据同时出现 `ResourceGroupLevelIdentityBasedPolicy`、`SubUser`、`ImplicitDeny` 和 bucket ownership 文案，只能形成候选原因，不能仅凭 403 宣布唯一根因。

## OSS 操作清单

| 阶段 | 调用位置 | 操作 | Key/Prefix | 身份 | 结论 |
| --- | --- | --- | --- | --- | --- |
| Doctor | `doctor.mjs` | List/Get | `<project>/<target>/<source>/` | Observer | 只读；403 必须阻断 |
| Runner 路由 | `runner-routing.mjs` | List/Get/immutable Put | `runner-routing/v1/requests/<request-id>/` | Build orchestrator | lease generation 当前依赖 List |
| Runner 槽位 | `runner-routing.mjs` | List/Get/immutable Put | `runner-routing/v1/slots/<slot>/claims/` | Build orchestrator | claim generation 当前依赖 List |
| 制品索引 | `oss.mjs` | exact Get/Head/immutable Put | `<project>/<target>/<source>/release-index-r4-seal-lifecycle.json` | Build | 已知 Key，不需要 List |
| 制品对象 | `oss.mjs` | exact Get/Head/immutable Put | `<project>/<target>/<source>/<digest>/...` | Build | 已知 digest 后不需要 List |
| Seal 发现 | `oss.mjs` | List/Get | `.../seals/v1/<node>/` | Observer/Release | artifact digest 未知时依赖 List；从精确 release index 取得 digest 后可改为 exact Get |
| Seal 生命周期 | `seal-lifecycle.mjs` | List/Get/immutable Put | exact Seal root 的 `leases/`、`failures/` 和阶段回执 | Build/Release | generation 发现仍依赖 List |
| Writer Lease | `release-writer-lease.mjs` | List/Get/immutable Put | exact writer root 的 `leases/`、`renewals/` | Release | generation 发现仍依赖 List |
| Deploy | `oss.mjs` / remote agent | exact Get | final Seal、manifest、archive | Release | 不需要 bucket 枚举 |

可在第二批移除的 List：制品索引解析、已知 artifact digest 与 control SHA 后的 final Seal 读取。必须先引入不可变 current-generation/current-seal 指针才能移除的 List：Runner request lease、slot claim、Seal lease/failure、Writer lease/renewal。Doctor 只提出替代建议，不改变真实策略。

Resume 不绕过 Readiness：OSS/RAM 403、Secret 合同、Runner 可见性或祖先关系任一失败都保持 `resumeAllowed=false`；只有修复原权限并重新通过 Doctor 后，才允许重放同一 source/base，不生成替代 source，不直接进入 Deploy。

## 最小权限矩阵草案

| 身份 | GitHub | OSS Get/Head | OSS List | OSS immutable Put | SSH/生产 |
| --- | --- | --- | --- | --- | --- |
| Observer/Doctor | Actions Runner 只读 | release index、Seal、回执 | 仅限定正式 project/target/source Prefix | 禁止 | 仅只读状态探针 |
| Build | Runner 只读 | Runner 路由、制品、Seal 上传阶段 | 仅 request/slot/Seal 精确 Prefix | Runner lease、制品、上传回执 | 禁止 |
| Release | Runner 只读 | final Seal、制品、Writer lease | 仅 Writer/Seal 精确 Prefix | 验证回执、final Seal、Writer lease | 指定物理节点部署通道 |

禁止 bucket 管理员和全桶通配。RAM 主账号归属、Bucket/Endpoint 区域、Resource Group、Identity Policy、显式 Deny 与 Prefix 范围必须分别核对。写能力无法由只读 Doctor 证明，固定输出 `UNVERIFIED_WRITE_CAPABILITY`。

## 评分

第一批只增加本地错误识别与合并前门禁证据。真实生产综合分维持 `56/100`；正确识别失败不等于生产成功路径通过。
