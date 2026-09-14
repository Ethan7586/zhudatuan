# AU-194｜Commerce API SMS provider 深审

短信适配器把debug限制在非生产环境，并以单次、短超时的Aliyun调用与净化错误码保护上游边界。配置/传输异常分支缺少direct test，记录F-0201/P3；未发现P0。
