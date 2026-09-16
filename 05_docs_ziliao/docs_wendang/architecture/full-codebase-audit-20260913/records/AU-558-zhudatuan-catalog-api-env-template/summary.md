# AU-558｜zhudatuan L0 catalog API 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/zhudatuan-l0/catalog-api.env.example`（18 行）；定向阅读 CatalogOperatorApiRuntime、L0 manifest 和 remote release target。
- 审阅方式：环境契约、API runtime startup checks、发布入口人工追踪；未启动 API 或读取真实对象/数据库。

## 真实运行关系

L0 catalog env → `sfl-catalog-api@zhudatuan-l0.service` → CatalogOperatorApi runtime → load node manifest → console-origin/feature/surface/lifecycle validation → Secret Store API pool + object-store readiness probe → AccessPipeline with L0 node-bound scope. Remote policy delivers CatalogOperatorApi artifacts to the same L0 target and restarts the same unit.

## 审计结论

- **G0**：`API_ALLOWED_ORIGINS=https://console.fufu.wang` 与 L0 manifest console origin 精确一致；runtime 强制唯一 console origin、catalog feature、console/api surfaces、active production lifecycle，并检查 DB role compatibility 与 object-store `catalog/readiness-probe`。
- database/object/secret endpoints、manifest/config/pointer 和 API port均对齐 L0 instance；所有 bearer/digest/version值为 placeholders。该模板是现行 L0 catalog control surface，非 AU-550 的 L1 stale ownership template。

## 未验证项

- 未验证实际 manifest digest注入、Secret Store DB role、object readiness object、AccessPipeline/RLS、systemd readiness/health check、DNS/tunnel 或线上 catalog operator request。
