# AU-332｜Supabase 售后、账本与登录尝试

`20260724113000_after_sales_and_ledgers.sql` 建立三条仅 `service_role` 可执行的业务 RPC：用户范围账户账本读取、用户范围售后读取、订单行锁后的售后申请与订单 `refund_pending` 状态转换，并把申请事实写入审计日志。它还建立 IP 哈希为主键的登录失败累计器；初版为 15 分钟窗口内第 5 次失败阻断 15 分钟，后续 `20260817190000_login_attempt_limit_ten.sql` 将阈值改为 10 次。

账本、售后读取和初版售后申请均有 Commerce API 调用；售后路由在 `/api/v1/after-sales` 实际注册。登录累计器被公开登录、微信绑定与二次验证调用，相关项目规则冲突已记录为 F-0235，本批没有重复记载。

发现 F-0238（P2）：兼容服务的售后提交路由仍调用旧 `api_create_after_sale`，而 canonical Supabase 后续迁移撤销了该函数的 `service_role` 权限、只授权 `api_create_after_sale_authorized`；仓内未找到新包装器的服务调用。与此同时，部署资料对数据库来源存在分歧：正式迁移目标指向 canonical `database/supabase/migrations`，而业主批准 UI 清单要求 storefront-compatibility 迁移，且 compatibility 制品清单标为不可发布。因此无法把线上故障写成事实，但任一不一致组合都可能使售后申请失败或落入非预期数据库版本。

未运行迁移、数据库或线上请求；结论来自固定基线的路由、服务凭据调用、迁移权限和发布配置静态证据。
