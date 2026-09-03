// Generated from config/cache.yml and config/capacity.yml. Do not edit.
export const CONFIG_CHECKSUM = '05c47ecafd0e6159c879574b2010f6f2464c368f32688d020ed4ef69317689b1' as const;

export const BROWSER_QUERY_POLICY = Object.freeze({
  "query": {
    "staleMilliseconds": 30000,
    "garbageCollectionMilliseconds": 300000,
    "retryCount": 1,
    "refetchOnWindowFocus": false,
    "refetchOnReconnect": true
  },
  "identity": {
    "parts": [
      "client",
      "scopekind",
      "scopeid",
      "accessversion",
      "resourceversion",
      "resource",
      "filter"
    ]
  },
  "storefrontIdentity": {
    "parts": [
      "handle",
      "mall",
      "releaseversion",
      "catalogversion",
      "resource",
      "filter"
    ]
  },
  "scopeChange": {
    "cancelPending": true,
    "removePrevious": true,
    "triggers": [
      "scopekind",
      "scopeid",
      "membership",
      "accessversion"
    ]
  }
} as const);

export const CACHE_CATALOG = Object.freeze({
  "experience": {
    "key": "mall:version",
    "maximumSeconds": 86400,
    "staleSeconds": 30,
    "commandRevalidate": false
  },
  "storefrontentry": {
    "key": "handle",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true
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
  "authentication": {
    "bootstrap": {
      "ttlSeconds": 600
    },
    "password": {
      "minimumLength": 12,
      "maximumLength": 128,
      "uppercase": true,
      "lowercase": true,
      "number": true,
      "symbol": true,
      "maximumConcurrency": 4,
      "maximumQueue": 64
    },
    "otp": {
      "validMinutes": 10,
      "resendSeconds": 30
    }
  },
  "poolBudget": {
    "databaseMaximumConnections": 100,
    "maximumUtilizationPercent": 70
  },
  "sql": {
    "defaultRows": 50,
    "maximumRows": 200,
    "maximumResponseBytes": 2097152,
    "maximumPlanCost": 100000
  },
  "external": {
    "connectionTimeoutMilliseconds": 3000,
    "responseTimeoutMilliseconds": 10000,
    "totalDeadlineMilliseconds": 15000,
    "maximumResponseBytes": 2097152,
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
    "maximumBodyBytes": 2097152,
    "maximumConcurrency": 256,
    "maximumQueue": 1024,
    "headersTimeoutMilliseconds": 10000,
    "keepAliveTimeoutMilliseconds": 5000,
    "maximumRequestsPerSocket": 1000
  },
  "stream": {
    "retentionEvents": 10000,
    "blockMilliseconds": 5000,
    "heartbeatMilliseconds": 15000,
    "maximumConnections": 2000,
    "maximumConnectionsPerScope": 100,
    "maximumEventBytes": 65536,
    "readBatch": 100,
    "reconnectMinimumMilliseconds": 500,
    "reconnectMaximumMilliseconds": 30000
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
