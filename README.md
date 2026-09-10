# 筑大团福利商城

本仓库是唯一正式开发与部署根目录。生产运行面固定为六个客户端、一个 Commerce 服务和一份 PostgreSQL 只追加迁移历史：

- `apps/auth`：统一身份入口。
- `apps/console`：运营控制台。
- `apps/storefront`：消费者商城，保留已批准 UI/UX。
- `apps/miniapp`：微信小程序消费者端。
- `apps/store`：门店履约端。
- `apps/supplier`：供应商协同端。
- `services/commerce`：唯一 API、Jobs、Provider 与 Migration 运行时；Smoke 仅做发布验证。
- `database/migrations`：唯一迁移事实源；历史迁移禁止改写。

Operation、Event、Error、Permission/Capability、Module、Provider、Runtime、Ownership、Requirement 均由各自唯一 Catalog 生成或校验。业务代码不得恢复旧服务、第二数据库、双写、兼容路由、Mock、Fallback 或 Simulation。

## 本地运行

```bash
npm ci
npm run local:prepare
npm run local:up
npm run local:services
npm run local:migrate
npm run local:seed
npm run local:verify
```

客户端与运行时：

```bash
npm run dev:auth
npm run dev:console
npm run dev:storefront
npm run dev:api
npm run dev:jobs
```

本地 Secret、KMS、Object Store 只实现生产协议，不向生产客户端添加文件或内存分支。所有 `.env.local`、TLS 私钥、Secret 文件与本地数据目录均被忽略。

## 质量门禁

```bash
npm run check:calls
npm run check:duplicates
npm run audit:architecture
npm run test:contract
npm run test:integration
npm run test:journey
npm run test:security
npm run test:performance
npm run build
npm run check:bundles
```

`npm run check` 是本地编排入口；发布门禁由 `check:authority`、`check:architecture`、`check:quality` 与 `check:release` 组成。发布只能消费六端不可变制品、Commerce OCI、SBOM、Provenance、完整事实 Hash、Migration Head、签名 Stage Evidence 和数据库快照。

## 环境网络入口

- 本地 Storefront 使用 `http://127.0.0.1:3000`，Auth、Console 和 Commerce API 分别使用本地清单声明的独立 Origin。
- 当前生产 Storefront 使用 `https://yengze.press`，Auth、Console 和 Commerce API 使用同一生产网络清单声明的独立 Origin。

生产 Origin 由 `infrastructure/network/Edge.yml` 唯一生成；本地 Origin 由 `tools/localinfra` 唯一生成到各工作负载环境，业务模块不写死域名，也不接受未列入当前环境清单的 Origin。

当前唯一架构与实施依据是 [福利商城理想方案20260904](docs/architecture/福利商城理想方案20260904.md) 和 [福利商城代码修改清单20260904](docs/architecture/福利商城代码修改清单20260904.md)；发布与恢复契约见 `docs/operations`。旧方案仅在 [归档目录](docs/archive/catalog.yml) 保留审计历史，不再作为事实源。
