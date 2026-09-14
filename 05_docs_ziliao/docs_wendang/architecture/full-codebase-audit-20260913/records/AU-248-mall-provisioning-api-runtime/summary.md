# AU-248｜Commerce MallProvisioningApiRuntime 深审

商城开通API以专用低权限role连接数据库，启动前检查schema、provisioning marker、所需relation/function/selected write及禁止业务域权限，再绑定访问、risk、decision和audit依赖。直接代码证实SQL计算了`contract`，但最终reject predicate遗漏它，故runtime会接受runtime contract marker不存在或checksum不匹配的数据库状态，记录F-0227/P1并待独立复核。Factory组装/释放未有direct fixture，记录F-0228/P2；无P0问题。
