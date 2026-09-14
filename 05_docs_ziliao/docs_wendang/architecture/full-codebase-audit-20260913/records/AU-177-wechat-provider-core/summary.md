# AU-177｜Commerce API WeChat Pay Provider core 深审

Provider client固定生产origin、签名每个请求，并在任何provider body解析前验证响应签名。配置、密钥格式、交易模型和provider错误均形成明确失败边界。未发现P0。
