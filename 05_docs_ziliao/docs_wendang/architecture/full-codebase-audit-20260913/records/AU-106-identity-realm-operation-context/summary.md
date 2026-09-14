# AU-106｜Identity realm operation context 深审

Realm operation context 从 DI 读取 pool、audit、KMS 与 identity/session key，构造 password policy、step-up policy 与带 return-target signer 的 auth ticket。identity HMAC、challenge HMAC 与 session hash 有独立输入和密钥职责。

注册引用强制 invite 或 storefront application 二选一；storefront slug 有受限格式。无效 invitation/storefront 被翻译为稳定业务响应。Node manifest 仅在有 parent node 时指定 notification scope。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行；关联操作测试已在 AU-103 至 AU-105 人工审阅。
