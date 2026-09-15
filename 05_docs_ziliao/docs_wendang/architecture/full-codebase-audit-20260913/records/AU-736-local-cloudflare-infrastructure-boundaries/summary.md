# AU-736｜本地与 Cloudflare 基础设施边界

- 审阅范围：通用 Aliyun 部署说明、Cloudflare 边界说明、本地运行说明和 local PostgreSQL 初始化脚本。
- 审阅方式：深入审阅本地角色/bootstrap guard、secret 输入与调用关系；部署/边缘说明与实际模板/检查器交叉核对。未启动容器、未连接数据库或云端。

## 审计结论

- `local/postgres-init.sh` 由 local compose 只读挂载到 PostgreSQL init 目录，创建最小 login/nologin roles、独立 registration database sentinel 和 security-definer boundary；本地 secret 生成器用 base64url 值，当前生成路径不会把单引号带入脚本的 SQL password literal。
- Cloudflare README 明确不是运行/发布 authority；本地 README 的 loopback/私有 CA 声明与 local runtime 边界相符，但实际端口绑定未启动验证。
- 通用 Aliyun DEPLOY 文档的“配置真值”声明与 hbbtzn 旧参考定位冲突，已由 F-0294 追踪；不以文档本身作为当前生产控制面证明。
- **G0：全部保留。** local bootstrap 与 Cloudflare boundary 都是运行/安全规格，不能按“无生产静态 import”删除。
