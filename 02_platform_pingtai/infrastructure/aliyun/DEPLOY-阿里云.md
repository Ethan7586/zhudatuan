# 福利商城阿里云发布

生产只接受 CI 生成、签名且已在预发布验收的同一份 Release Bundle；生产节点禁止拉源码、安装开发依赖或重新构建。

## 拓扑

- WAF/CDN：接入公网流量并执行 5% → 25% → 50% → 100% 分段放量。
- OSS：保存 Console、Store、Supplier、Storefront、Auth、Miniapp 六份不可变客户端制品；`releases/current.json` 是唯一原子指针。
- ALB：只把 `/api/v1/*` 与 `/health/*` 转发给 ACK 内的 `shop-api` Service。
- ACK：至少三个 ApiMain Pod、两个 JobsMain Pod，跨可用区调度；MigrationMain 仅作为一次性 Job 运行。
- RDS PostgreSQL：主备、持续 WAL、PITR、跨地域副本和客户管理 KMS 密钥。
- Redis、队列、OSS、KMS、Secret Manager：仅通过工作负载身份与 Secret Reference 访问，不向 Pod 写入长期明文凭据。

配置真值分别位于 `runtime.template.yml`、`migration.template.yml`、`delivery.yml` 与 `backup.yml`。不存在 PM2、Vite Preview、Caddy、独立缓存服务或旧 API/Job 进程。

## Release Bundle 合同

发布目录必须是绝对路径，并包含：

```text
release.json
release.sigstore.json
checksums.sha256
current.json
sbom.cdx.json
provenance.json
clients/
  auth/
  console/
  miniapp/
  store/
  storefront/
  supplier/
```

`release.json` 必须符合 `shop.release.v1`，同时绑定 Git Commit、Contract Hash、Target Schema Head、Commerce 镜像 Digest、六端文件 Hash、SBOM、Provenance、数据库快照、预发布结果、11 个 P1 Provider 正式沙箱结果与业务发布批准。`04_tools/scripts/release/validate.mjs` 失败时发布关闭。

## 硬切顺序

1. WAF/ALB 打开维护状态，拒绝新会话和写入；排空请求、Outbox、Queue 和 Job Lease。
2. 创建并验证可恢复整库快照，记录不可变 OSS 引用。
3. 停止旧 ApiMain 和 JobsMain，确认旧实例为零。
4. `deploy.sh` 先验 Sigstore Bundle、文件 Hash、SBOM/Provenance、预发布与批准证据。
5. 运行绑定同一 Commerce 镜像 Digest 的 MigrationMain，执行 Target Schema、Backfill、Reconciliation 与旧对象删除；失败保持维护状态。
6. 上传六端不可变 OSS 目录，启动新的三副本 ApiMain 与双副本 JobsMain，通过 Startup、Readiness、Liveness 和集群内 Smoke。
7. 原子更新 `releases/current.json`；ALB 仅向新版本按 5%、25%、50%、100% 开流，其余流量继续看到维护页，不回流到旧版本。
8. 每档核对 SLI、Error Budget、订单/支付/退款/库存/卡券/福利/账务、Provider Health、Audit 与 Trace；任一异常立即冻结新写并执行 `05_docs_ziliao/docs_wendang/runbooks_yunwei/releaserollback.md` 的整库快照和匹配旧制品原子恢复。
9. 稳定窗口结束后关闭旧凭据、旧数据库角色、旧队列、旧域名和旧资源，只保留签名发布证据。

## 执行

发布账号必须使用短期工作负载身份，并预装 `cosign`、`jq`、`kubectl` 与 `ossutil`。`SHOP_CUTOVER_CONTROLLER` 指向经审计的绝对可执行 Adapter，统一封装 ALB/WAF 维护、排空、RDS 快照验证、各档 SLI/业务不变量验证以及“整库快照 + 匹配旧制品”原子回滚，发布脚本不重复云厂商规则：

```bash
02_platform_pingtai/infrastructure/aliyun/deploy.sh /absolute/path/to/signed-release
```

`SHOP_NAMESPACE`、`SHOP_RELEASE_IDENTITY` 和 `SHOP_RELEASE_ISSUER` 由受保护环境配置。Release 脚本不会读取 Git、不会运行 `npm ci`、不会构建，也不接受 Tag 或 Branch 作为发布输入。

## 失败关闭

- 签名、Hash、镜像 Digest、Schema Head、Client Set、SBOM、Provenance、数据库快照、Provider Sandbox、Stage 或 Approval 任一缺失：不得停旧实例。
- Migration 开始后失败：保持维护状态，不在新 Schema 上恢复旧进程。
- Smoke 失败：不切换 OSS 指针，不开放公网流量。
- 金丝雀异常：停止新写，整库恢复与旧签名制品必须作为一个原子回滚单元，禁止双写、兼容路由或旧新并行访问目标库。
