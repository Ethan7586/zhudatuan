# AU-227｜Commerce CircuitBreaker contract 深审

CircuitBreaker通过Executor将外部调用接到`@shop/kernel`熔断原语，运行参数由RUNTIME_LIMITS提供。静态消费者明确，无独立业务逻辑或P0–P3问题。
