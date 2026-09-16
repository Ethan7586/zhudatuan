# AU-174｜Commerce API RPC/crypto adapter 深审

适配器集中承接数据库RPC和PII加密。RPC错误被限量读取并向上抛出；PII使用AES-GCM随机IV。缺少直接加密行为规格，记录F-0189/P2；未发现P0。
