# AU-212｜Commerce Generic BatchImport 深审

BatchImportProcessor是member、inventory和voucher生产导入任务共享状态机，负责文件/哈希校验、分段处理、失败报告、完成与错误分类。三个任务均经Jobs catalog运行；没有该公共状态机direct fixture，记录F-0210/P2。无P0/P1问题。
