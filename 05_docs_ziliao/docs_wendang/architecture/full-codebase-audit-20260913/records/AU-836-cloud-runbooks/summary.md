# AU-836｜云运维参考手册族

- 覆盖范围：runbooks_yunwei 下 14 份同构事故手册，共 294 行。
- 审阅方法：database failover、payment incident、release rollback 三份高影响主题深入审阅；其余按同一 21 行模板逐文件核对主题、stop loss、诊断、恢复、验证与升级段。
- 结论：全部手册均为人工响应参考，不含可执行命令或自动配置；databasefailover 与 releaserollback 被当前 Aliyun 备份/部署说明静态引用。保留为 G0，不作为删除候选；线上执行步骤仍须以当时受控交付接口和实际运行状态为准。
