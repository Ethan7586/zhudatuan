# 福利商城架构入口

完整系统图、模块时序、数据流、DDD 边界、目录结构、测试矩阵与硬切发布见 `福利商城根治实施方案.md`；逐项广域基线见 `福利商城架构和补齐修改清单.md`；逐文件动作见 `福利商城代码修改清单.md`。

```text
Console  Store  Supplier  Storefront  Miniapp  Auth
   └────────────── WAF / CDN / ALB ──────────────┘
                         │
                  Commerce ApiMain ×3+
                         │
         PostgreSQL ─ Redis HA ─ Queue ─ OSS/KMS
                         │
                  Commerce JobsMain ×2+
                         │
        Payment / SMS / Invoice / 11 P1 Providers
```

唯一依赖方向：

```text
客户端 app → route/shell → feature → entity → shared → @shop/sdk
后端 interface → application → domain ← port ← infrastructure
bootstrap 只组合 Module、Operation、Event、Job 和 Extension Registry
```

浏览器不持有数据库或服务账号凭据；客户端提交的 Tenant、Scope、Role 和 Permission 不可信；跨模块只允许公开 Application Port 或 Event。生产仅运行一个 Commerce 制品的 ApiMain/JobsMain，并用同一镜像的 MigrationMain 执行一次性迁移。
