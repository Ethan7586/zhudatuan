# AU-022 验证结果

## 正式入口

- `npm test -- --reporter=dot`：退出码127，`vitest: command not found`；源码未加载。
- `npm run typecheck`：退出码127，`tsc: command not found`；源码未进入类型检查。
- 未安装依赖，未执行build。

## 只读数据流与反事实检查

1. `channel.connections.create/update`把operator输入的`configuration.baseUrl`和`secretRef`传给InstallExtension；配置检查仅为`startsWith('https://')`。
2. RuntimeExtensionLoader读取该secret和base URL，具体vendor构造HMAC/RSA认证器；VendorClient以`new URL(path, baseUrl)`首跳并添加认证头。Connection校验没有host/IP/userinfo或Manifest绑定，形成F-0096。
3. VendorClient在响应阶段直接`response.text()`，随后`JSON.parse`并递归检查JSON值；没有字节或深度上限。全包无其它包装层，形成F-0097。
4. Cakeuncle专用Client实现独立`readLimited`，不能保护使用通用VendorClient的四个vendor家族。

未连接线上网络、provider、secret store或数据库；F-0096/F-0097保持P1候选，分别进入RV-0014/RV-0015。
