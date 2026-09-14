# AU-279｜AccessPipeline 深审

PipelineAuthorizer只转发到AccessPipeline。管线依次处理会话、受众/feature、membership/version/scope、governance/capability/resource、step-up/risk和金融proof，并对allow/deny统一审计。fixture覆盖operator/storefront、membership mismatch、资源探测顺序和授权mall不可由请求body覆盖。无P0–P3新问题。
