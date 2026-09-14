# AU-251｜Commerce ConsoleSupportRuntime 深审

Console support API用专用login role与session role启动，连接前检查support marker、所需关系/函数和选择性访问权限，并装配metrics、访问、risk、audit、KMS。compatibility query已计算`contract`，最终predicate同样遗漏`!state.contract`，记录F-0229/P1待独立复核。factory生命周期未有direct fixture，记录F-0230/P2；无P0问题。
