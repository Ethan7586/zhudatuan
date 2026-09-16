# AU-092｜WebBusiness 公开目录数据库投影与权限边界深审

公开目录函数以 SECURITY DEFINER 执行，固定 search path，并只向 zhudatuanwebapi 授予 execute。它在函数内要求 active application、有效 release、对应 binding、已发布 listing、有效价格及可用层级库存。

HTTP wrapper 先由 host/default application 选择 slug，并拒绝不等于该选择结果的 mall 参数；因此调用方不能借 query 参数切换到另一公开 application。

发现 F-0162/P2：HTTP 允许最大 JavaScript safe integer 的 cursor，但数据库函数参数为 PostgreSQL integer，超出 2,147,483,647 的输入将不按预期成为 400。
