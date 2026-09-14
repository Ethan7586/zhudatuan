# AU-171｜Commerce API compatibility public auth 深审

兼容登录、credential discovery、初始密码变更与退出的实现仍完整，但当前正式路由没有注册它们：全路由主动拒绝 `/api/v1/auth/*`，Storefront Worker只接入health/catalog/payment。现存客户端调用、公开导出、测试和兼容构建责任，结论为DC-0048/G1；未发现P0。
