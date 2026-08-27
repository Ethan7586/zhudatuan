// Generated from config/cache.yml and config/capacity.yml. Do not edit.
export const CACHE_CATALOG = Object.freeze({
  "experience": {
    "key": "mall:version",
    "maximumSeconds": 86400,
    "staleSeconds": 30,
    "commandRevalidate": false
  },
  "catalog": {
    "key": "mall:listing:version",
    "maximumSeconds": 300,
    "staleSeconds": 30,
    "commandRevalidate": true
  },
  "category": {
    "key": "mall:categoryversion",
    "maximumSeconds": 3600,
    "staleSeconds": 60,
    "commandRevalidate": true
  },
  "access": {
    "key": "membership:authzversion:capabilityversion",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true
  },
  "reporting": {
    "key": "scope:metric:period:projectionversion",
    "maximumSeconds": 300,
    "staleSeconds": 60,
    "commandRevalidate": false
  },
  "session": {
    "key": "session:version",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true
  }
} as const);

export const CAPACITY_MODEL = Object.freeze({
  "malls": 1000,
  "members": 10000000,
  "products": 5000000,
  "skus": 20000000,
  "peakApiQps": 5000,
  "peakOrderTps": 300,
  "peakPaymentCallbackTps": 600,
  "voucherBatch": 1000000,
  "reportDays": 366,
  "annualGrowthPercent": 80
} as const);

export const PROVIDER_CAPACITY = Object.freeze({
  "maxConnections": 1000,
  "defaultRequestsPerSecond": 20
} as const);

export const RUNTIME_LIMITS = Object.freeze({
  "external": {
    "connectionTimeoutMilliseconds": 3000,
    "responseTimeoutMilliseconds": 10000,
    "totalDeadlineMilliseconds": 15000,
    "maximumConcurrency": 32,
    "maximumQueue": 128,
    "requestsPerSecond": 100,
    "attempts": 2,
    "retryMinimumMilliseconds": 50,
    "retryMaximumMilliseconds": 1000,
    "failureThreshold": 5,
    "recoveryMilliseconds": 30000
  },
  "http": {
    "totalDeadlineMilliseconds": 15000,
    "headersTimeoutMilliseconds": 10000,
    "keepAliveTimeoutMilliseconds": 5000,
    "maximumRequestsPerSocket": 1000
  },
  "pool": {
    "query": {
      "maximumConnections": 24,
      "connectionTimeoutMilliseconds": 3000,
      "idleTimeoutMilliseconds": 30000,
      "statementTimeoutMilliseconds": 5000,
      "idleTransactionTimeoutMilliseconds": 15000
    },
    "command": {
      "maximumConnections": 20,
      "connectionTimeoutMilliseconds": 3000,
      "idleTimeoutMilliseconds": 30000,
      "statementTimeoutMilliseconds": 10000,
      "idleTransactionTimeoutMilliseconds": 15000
    },
    "worker": {
      "maximumConnections": 24,
      "connectionTimeoutMilliseconds": 5000,
      "idleTimeoutMilliseconds": 30000,
      "statementTimeoutMilliseconds": 120000,
      "idleTransactionTimeoutMilliseconds": 15000
    },
    "migration": {
      "maximumConnections": 1,
      "connectionTimeoutMilliseconds": 5000,
      "idleTimeoutMilliseconds": 30000,
      "statementTimeoutMilliseconds": 0,
      "idleTransactionTimeoutMilliseconds": 0
    }
  }
} as const);
