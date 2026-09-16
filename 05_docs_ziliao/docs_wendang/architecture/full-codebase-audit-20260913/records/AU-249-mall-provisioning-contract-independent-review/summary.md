# AU-249｜Mall provisioning runtime contract 独立复核

第二轮从生产入口、compatibility query与predicate重新核验：`MallProvisioningApiMain`无额外contract gate，factory只调用同一assertion后即bootstrap/listen；query将contract列映射为`CompatibilityRow.contract`，但predicate仍未读取该字段。F-0227/P1双轮一致确认；无P0问题，不修改代码。
