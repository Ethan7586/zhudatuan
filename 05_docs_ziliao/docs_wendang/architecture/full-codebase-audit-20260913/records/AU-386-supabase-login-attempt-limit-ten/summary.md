# AU-386｜Supabase 登录尝试阈值

`20260817190000_login_attempt_limit_ten.sql` 将共享 IP 登录失败门槛由五次提高到十次，但仍保留十五分钟窗口和十五分钟 `blocked_until`。当前公开登录、微信绑定、二次验证和初始密码变更均调用同一 `api_login_allowed` / `api_record_login_failure` 链。

该迁移是当前登录失败累积器的函数定义，归 G0；其可用性与项目既定身份规则冲突继续归既有 F-0235。本单元更正该 finding 的当前阈值为十次，未新增 P0–P3 或删除候选。未执行登录、测试、数据库写入或线上检查。
