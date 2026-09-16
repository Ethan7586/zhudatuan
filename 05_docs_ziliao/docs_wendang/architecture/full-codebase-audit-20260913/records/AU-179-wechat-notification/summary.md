# AU-179｜Commerce API WeChat payment notification 深审

生产public callback在签名验证之后才解密和调用idempotent payment RPC，并只保存必要的交易摘要。公开route缺少direct RPC/response fixture，记录F-0191/P2；未发现P0。
