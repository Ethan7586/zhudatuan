# AU-169｜Storefront public catalog/media/payment notification 深审

Storefront 实际公开链只返回不可购买的目录投影；目录缓存和媒体 proxy 有明确租户、来源、签名、大小边界。Wechat 通知不走用户会话，验签解密后进入受管 RPC。未发现 P0。
