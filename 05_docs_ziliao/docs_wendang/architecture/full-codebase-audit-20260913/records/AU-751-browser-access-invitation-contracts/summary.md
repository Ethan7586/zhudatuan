# AU-751｜浏览器访问角色与会员邀请契约

- 审阅范围：AccessRoles config/spec、MemberInvitation/MemberInstantOpen spec 及两份 Playwright config。
- 审阅方式：深入审阅访问角色 mock state mutation、写入 header/body 和邀请 modal/clipboard 边界；同构 Playwright configs 结构性审阅。未运行浏览器或本地服务。

## 审计结论

- **G0：全部是有效 browser test 输入。** AccessRoles config 受控启动本地 Console bundle；代表性规格验证角色创建/改名/成员分配撤销/删除后的重读、`If-Match`、scope/access version 和响应式布局。
- 邀请/instant-open 规格检查 clipboard、不可误关的 loading dialog、请求 body、无障碍和浏览器错误。测试 API 均由 OperationMock 拦截；不能把“正式接口重读”等文案理解为真实身份/权限服务已验证。
