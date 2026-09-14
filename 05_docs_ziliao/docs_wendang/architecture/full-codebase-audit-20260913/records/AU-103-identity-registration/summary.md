# AU-103｜Identity 注册、挑战与邀请兑换深审

注册 challenge 将用途、规范化手机号、当前 realm 和 invite/storefront registration hash 一并保存；邀请码或公开 storefront 均在发 challenge 前验证。member create 以 realm 加 subject 的 advisory transaction lock 串行化，消费 phone proof 后校验 invite/storefront、条款、realm/target 与现有身份，再创建或复用 identity/member/membership。

新 storefront 身份先通过 hosted member node 注册边界取得 consumer realm；最终 WeChat bind、identity outbox、session、ticket 和可选 login intent 在同一 identity mutation 中完成。失败用 savepoint 回滚。phoneVerification=checkout 是显式的 storefront password 注册分支，创建 assurance level 1 session，测试覆盖无 challenge 消费和无 phone OTP assurance。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
