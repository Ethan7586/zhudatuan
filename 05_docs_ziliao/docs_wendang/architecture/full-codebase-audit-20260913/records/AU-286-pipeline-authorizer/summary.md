# AU-286｜PipelineAuthorizer 深审

`PipelineAuthorizer` 是 OperationController 的薄适配器：原样转交 headers、operation、permission 和可选 resource 给已深审的 `AccessPipeline`，不产生授权分支、默认值或状态。Commerce、Console、Purchase、WebBusiness、MallProvisioning、CatalogOperator 与 IdentityRegistration 运行时均将其绑定为唯一 OperationAuthorizer；AccessPipeline fixture 经真实 Controller 路由覆盖该委派链。未发现 P0–P3 新问题。
