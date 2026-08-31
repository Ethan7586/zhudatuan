# 筑大团福利商城

本仓库是唯一正式开发与部署根目录。生产运行面固定为三个客户端、一个 Commerce 服务和一份 PostgreSQL 只追加迁移历史：

- `apps/auth`：统一身份入口。
- `apps/console`：运营控制台。
- `apps/storefront`：消费者商城，保留已批准 UI/UX。
- `services/commerce`：唯一 API、Jobs、Migration 与 Smoke 运行时。
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

`npm run quality` 是完整顺序门禁。发布只能消费三端不可变制品、Commerce OCI、SBOM、Provenance、完整事实 Hash、Migration Head、签名 Stage Evidence 和数据库快照。

## 正式域名

- `zhudatuan.com`：Storefront。
- `accounts.zhudatuan.com`：Auth。
- `console.zhudatuan.com`：Console。
- `api.zhudatuan.com`：Commerce API。

详细架构、发布和恢复契约见 `docs/architecture` 与 `docs/operations`。
