# RV-0005｜Registration PostgreSQL 初始化与恢复独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从 compose → Docker 首次空卷 init hook → SQL target guard → env/check fixture 重新取证；未运行容器、未挂载数据卷、未执行 SQL。

## 事实链与裁决

1. `registration-compose.yml:3-35` 固定 `postgres:17-alpine`，并在空 data volume 时将 `postgres-init-registration.sh` 挂为 Docker init hook。
2. 初始化脚本 `:74-77` 对 `server_version_num >= 170000` 抛出 `ZHUDATUAN_RDS_INIT_POSTGRES_VERSION_INVALID`，故 PG17 的首次 init 必定在任何 DDL 前失败。
3. 即使忽略该版本矛盾，脚本 `:83-105` 还要求已存在 `zhudatuanregistrationboundary`、精确 private RDS server address 及 RDS-like authority；stock 本地空 PG container 不具备这些前置。`postgres.env.example` 不含 `ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR`。
4. `registration-deployment.mjs:18-21,85,188` 只要求 PG16 fixture token 与脚本文本，未交叉断言 Compose 镜像 major、空卷拓扑或 env 契约一致。PG17 fixtures 出现在其它 SFL contract，不是 registration init 的恢复验证。

**F-0023 确认 P1，高置信度。** 现有 registration volume 丢失、新节点或灾备空卷恢复时，声明的 PG17 Compose 路径无法通过其自身 init guard；没有安全地证明的从零恢复替代路径。不是 P0：未发现现有 volume 已损坏或当前服务已中断。

## 后续修复边界

仅从当时最新主线建立恢复设计分支，先确认“RDS/PG16 权威拓扑”或“本地 PG17 权威拓扑”之一，再让 Compose、init、env、check 和隔离新卷演练共享同一契约。不得在生产卷实验、修改历史迁移或以绕过 guard 代替恢复设计；配置回滚不等同于已执行数据效果回滚。

本复核未修改数据、容器、配置或线上状态。
