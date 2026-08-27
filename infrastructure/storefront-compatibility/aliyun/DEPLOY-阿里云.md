# 阿里云部署

运行目录统一为 `/opt/smart-wing`。前台/API 与运营后台从同一 Git 提交构建，但为两个 PM2 进程：

| 域名               | PM2 进程                | 端口 | 代码                                            |
| ------------------ | ----------------------- | ---- | ----------------------------------------------- |
| `hbbtzn.com`       | `smart-wing-storefront` | 3000 | `apps/storefront-web` + `services/commerce-api` |
| `hbbtzn.com/login` | `smart-wing-auth-web`   | 3010 | `apps/auth-web`（统一登录）                     |
| `smart.hbbtzn.com` | `smart-wing-admin-api`  | 3001 | `apps/admin-web` + `services/commerce-api`      |

可选的北京同地域读镜像为第四个 PM2 进程 `smart-wing-core-read-cache`，仅监听 `127.0.0.1:3002`，不经过 Caddy。环境变量完整时，日常发布脚本会自动启动或重载它；未配置 Tair 时不会启动，也不会影响主站回源数据库。

## 首次迁移

```bash
git clone git@github.com:Ethan7586/smart-wing.git /opt/smart-wing
cd /opt/smart-wing
cp services/commerce-api/.env.example .env.production
# 编辑 .env.production，填写仅服务器持有的密钥
npm ci --include=dev
npm run build
cp infrastructure/aliyun/Caddyfile /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
pm2 start infrastructure/aliyun/ecosystem.config.cjs
pm2 save
```

## 日常发布

```bash
cd /opt/smart-wing
bash infrastructure/aliyun/deploy.sh
```

发布后必须验证：

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -I https://hbbtzn.com
curl -I https://smart.hbbtzn.com
```

## 启用核心读镜像

先在阿里云创建与 ECS 同地域、同 VPC 的高可用 Tair 实例，只开放 ECS 私网白名单并开启 TLS。然后在 `/opt/smart-wing/.env.production` 增加：

```dotenv
CORE_READ_CACHE_URL=http://127.0.0.1:3002
CORE_READ_CACHE_TOKEN=独立随机内部令牌
TAIR_HOST=实例的 VPC 内网地址
TAIR_PORT=6379
TAIR_USERNAME=实例账号
TAIR_PASSWORD=实例密码
TAIR_TLS_ENABLED=true
```

不要把 Tair 地址放到小程序、Web 环境或 Caddy。运行日常发布后验证：

```bash
curl -fsS http://127.0.0.1:3002/health
curl -sSI 'https://hbbtzn.com/api/v1/catalog/public/products?cursor=0&limit=24' | grep -Ei 'etag|x-sw-catalog-cache|x-sw-catalog-version'
```

第一次可能为 `source`，第二次应为 `memory`；单独重启 Storefront 后应出现 `shared`，证明镜像不依赖 Web 进程内存。

## 启用数据库异云备份

这套备份用于“Supabase 仍为主库、阿里云保存可独立恢复副本”的阶段。它不是第二个可写主库，也不参与在线请求。

1. 在阿里云创建**私有** OSS Bucket，开启版本控制，并为备份前缀配置生命周期；应用图片桶和数据库备份桶必须分开。
2. 创建只允许该 Bucket `database/postgresql/*` 读写的 RAM 身份，不使用账号主 AccessKey。
3. 从 Supabase 获取 PostgreSQL **Direct connection** 连接串，填入服务器专用环境文件；REST `service_role` key 不能替代数据库连接串。
4. 服务器安装与主库兼容或更高版本的 `pg_dump` / `pg_restore`。

```bash
cd /opt/smart-wing
cp infrastructure/aliyun/backup.env.example /opt/smart-wing/.env.backup
chmod 600 /opt/smart-wing/.env.backup
# 编辑 .env.backup，只填写备份专用连接串、Bucket 与最小权限 RAM 凭据
install -d -m 0700 /var/backups/smart-wing/postgres
cp infrastructure/aliyun/smart-wing-postgres-backup.service /etc/systemd/system/
cp infrastructure/aliyun/smart-wing-postgres-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl start smart-wing-postgres-backup.service
journalctl -u smart-wing-postgres-backup.service --no-pager -n 100
systemctl enable --now smart-wing-postgres-backup.timer
systemctl list-timers smart-wing-postgres-backup.timer
```

只有日志返回 `"backup":"verified"` 才算一次成功：备份文件已完成、`pg_restore --list` 可读、SHA-256 清单已生成、OSS 对象长度已回读核对。每月将最新备份恢复到隔离的临时 PostgreSQL 并执行核心表数量与抽样校验；禁止直接在生产主库试恢复。

备份任务与商城发布解耦。缺少 `.env.backup` 时日常发布仍正常，但不能声称数据库已具备异云恢复能力。

`.env.production` 不进 Git，也不复制到 `apps/`。Cookie 必须保持 host-only，不设置 `.hbbtzn.com` 的共享 Domain。生产必须分别配置 `SESSION_SIGNING_KEY` 与 `ADMIN_SESSION_SIGNING_KEY`（两者不得相同），否则后台域不会签发或接受会话。

## 测试登录限流白名单

仅当公开环境明确以 `APP_ENV=test`、`AUTH_MODE=test` 运行时，才允许在服务器的
`.env.production` 中临时配置精确公网 IP：

```dotenv
TEST_LOGIN_RATE_LIMIT_BYPASS_IPS=203.0.113.10,2001:db8::10
TEST_LOGIN_RATE_LIMIT_BYPASS_FROM=2026-08-12T00:00:00Z
TEST_LOGIN_RATE_LIMIT_BYPASS_UNTIL=2026-08-13T00:00:00Z
```

- 只接受精确 IPv4/IPv6；不接受 CIDR、通配符或 `unknown`。
- 开始和到期时间都必须包含时区，整个有效窗口不超过 24 小时。配置缺失、非法、未生效、过期或过长时自动按未命中处理。
- 白名单只跳过登录失败限流；账号、密码、Membership 和 Cookie 校验均保持不变。
- 客户端 IP 必须从原测试网络访问 `https://hbbtzn.com/cdn-cgi/trace` 后复制 `ip=` 的值；代理、VPN 或移动网络变化后需要重新确认。
- 修改环境变量后运行 `pm2 startOrReload infrastructure/aliyun/ecosystem.config.cjs --update-env` 并 `pm2 save`。
- 每次更新 Caddy 前核对 `https://www.cloudflare.com/ips-v4` 与 `https://www.cloudflare.com/ips-v6`，确保可信代理范围仍是 Cloudflare 官方最新列表。
