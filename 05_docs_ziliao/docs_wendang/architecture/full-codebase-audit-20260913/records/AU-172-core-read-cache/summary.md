# AU-172｜Commerce API core read-cache client 深审

公共目录缓存client只允许私有端点；读故障、配置缺失和写故障均为不改变响应的回源路径。实际消费者是public catalog，sidecar是否部署由独立部署单元决定。未发现P0。
