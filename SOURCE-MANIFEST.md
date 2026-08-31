# Canonical Source Manifest

记录日期：2026-08-29（Asia/Shanghai）

## 唯一生产源码

| Surface    | 唯一入口                                     | 约束                                          |
| ---------- | -------------------------------------------- | --------------------------------------------- |
| Auth       | `apps/auth/src/main.tsx`                     | 统一身份、Host-only Session、PKCE/Ticket      |
| Console    | `apps/console/src/main.tsx`                  | 保留批准 UI/UX，路由绑定 Canonical Navigation |
| Storefront | `apps/storefront/app/page.tsx`               | 保留批准消费者 UI/UX，只调用 Contract SDK     |
| API        | `services/commerce/src/app/ApiMain.ts`       | 唯一 API 上游池                               |
| Jobs       | `services/commerce/src/app/JobsMain.ts`      | 33 项 Job 单一 Catalog                        |
| Migration  | `services/commerce/src/app/MigrationMain.ts` | 仅回放 `database/migrations`                  |
| Smoke      | `services/commerce/src/app/SmokeMain.ts`     | 发布后真实合同探测                            |

## 唯一事实源

- Requirement/MVP：指定工作簿及固定 SHA-256，由 Requirement Generator 生成。
- Operation/Event/Error：`packages/contract/definitions`。
- Permission/Capability：`packages/authz` 与 Contract Catalog。
- Module/Public Port：28 个 Module Manifest。
- Provider：签名 Extension Manifest。
- Runtime/SLO/容量：Typed Config 与 Telemetry Catalog。
- 数据对象/所有权/迁移：`database/contracts` 与 `database/migrations`。
- 发布：三端制品、Commerce OCI、SBOM、Provenance、事实 Hash 与签名 Evidence。

## 明确排除

- 任意旧客户端、旧服务、第二数据库、第二迁移历史、双写和代理路由。
- Compatibility、Mock、Fallback、Simulation、Showcase、Demo 和设计辅助发布面。
- `node_modules`、`dist`、本地缓存、`.env.local`、TLS 私钥、Secret、支付证书。
- 目录外历史档案；它们不得参与 Generator、Build、Test、Runtime 或 Deploy。

机器可读制品集合由 `config/artifacts.json`、Release Candidate Facts 和签名 Release Manifest 共同约束。目录外观或人工清单不得替代 Hash、契约门禁和真实运行证据。
