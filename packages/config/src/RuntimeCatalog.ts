// Generated from config/cache.yml and config/capacity.yml. Do not edit.
export const CONFIG_CHECKSUM = '35da7f1e3cf857c8d3cf8fa2c1bff6c1c4bb28123dbfa1ee86337046ee53e645' as const;

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
  "publishedexperience": {
    "key": "mall:publicationversion",
    "maximumSeconds": 86400,
    "staleSeconds": 30,
    "commandRevalidate": false,
    "invalidatedBy": [
      "experience.release.activated"
    ]
  },
  "storefrontentry": {
    "key": "handle",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true,
    "invalidatedBy": [
      "experience.release.activated",
      "organization.membership.changed"
    ]
  },
  "listing": {
    "key": "mall:listing:version",
    "maximumSeconds": 300,
    "staleSeconds": 30,
    "commandRevalidate": true,
    "invalidatedBy": [
      "catalog.listing.published",
      "catalog.listing.unpublished",
      "pricing.rule.published",
      "pricing.offer.changed",
      "inventory.stock.changed"
    ]
  },
  "category": {
    "key": "mall:categoryversion",
    "maximumSeconds": 3600,
    "staleSeconds": 60,
    "commandRevalidate": true,
    "invalidatedBy": [
      "catalog.listing.published",
      "catalog.listing.unpublished"
    ]
  },
  "accessversion": {
    "key": "membership:authzversion:capabilityversion",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true,
    "invalidatedBy": [
      "access.version.changed",
      "capability.changed",
      "organization.membership.changed"
    ]
  },
  "navigation": {
    "key": "target:membership:scope:authzversion:capabilityversion:catalogversion",
    "maximumSeconds": 300,
    "staleSeconds": 0,
    "commandRevalidate": true,
    "invalidatedBy": [
      "navigation.catalog.changed",
      "access.version.changed",
      "capability.changed",
      "organization.membership.changed",
      "extension.enabled",
      "extension.disabled"
    ]
  },
  "providerhealth": {
    "key": "provider:capability:healthversion",
    "maximumSeconds": 30,
    "staleSeconds": 5,
    "commandRevalidate": false,
    "invalidatedBy": [
      "channel.sync.completed",
      "extension.enabled",
      "extension.disabled",
      "extension.degraded"
    ]
  },
  "reportingwatermark": {
    "key": "scope:metric:period:projectionversion",
    "maximumSeconds": 300,
    "staleSeconds": 60,
    "commandRevalidate": false,
    "invalidatedBy": [
      "order.placed",
      "order.paid",
      "finance.entry.posted"
    ]
  },
  "session": {
    "key": "session:version",
    "maximumSeconds": 60,
    "staleSeconds": 0,
    "commandRevalidate": true,
    "invalidatedBy": [
      "identity.session.revoked",
      "identity.member.reset"
    ]
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
  "voucherCredentials": 10000000,
  "concurrentImports": 64,
  "reportDays": 366,
  "annualGrowthPercent": 80
} as const);

export const PROVIDER_CAPACITY = Object.freeze({
  "maxConnections": 1000,
  "defaultRequestsPerSecond": 20
} as const);

export const IMPORT_CAPACITY = Object.freeze({
  "kinds": [
    "member",
    "product",
    "inventory",
    "vouchercredential",
    "finance",
    "order"
  ],
  "maximumRows": 1000000,
  "previewRows": 100,
  "chunkRows": 1000,
  "maximumConcurrentJobs": 32,
  "maximumConcurrentChunks": 8,
  "maximumConcurrentRows": 8,
  "chunkLeaseSeconds": 300,
  "maximumFileBytes": 1073741824,
  "maximumSpreadsheetBytes": 33554432,
  "maximumExpandedBytes": 268435456,
  "maximumCompressionRatio": 100,
  "maximumSpreadsheetEntries": 10000,
  "maximumColumns": 128
} as const);

export const WORKER_CAPACITY = Object.freeze({
  "provider": {
    "concurrency": 32,
    "queue": 1024,
    "deadlineMilliseconds": 120000
  },
  "report": {
    "concurrency": 8,
    "queue": 256,
    "deadlineMilliseconds": 300000
  },
  "notification": {
    "concurrency": 32,
    "queue": 2048,
    "deadlineMilliseconds": 30000
  }
} as const);

export const CLIENT_BUNDLE_CAPACITY = Object.freeze({
  "auth": {
    "initialGzipKb": 90,
    "featureGzipKb": 80
  },
  "console": {
    "initialGzipKb": 95,
    "featureGzipKb": 100
  },
  "storefront": {
    "initialGzipKb": 110,
    "featureGzipKb": 100
  },
  "miniapp": {
    "initialGzipKb": 80,
    "featureGzipKb": 80
  },
  "store": {
    "initialGzipKb": 95,
    "featureGzipKb": 90
  },
  "supplier": {
    "initialGzipKb": 95,
    "featureGzipKb": 90
  }
} as const);

export const NAVIGATION_CAPACITY = Object.freeze({
  "maximumRoutes": 200,
  "maximumNodes": 200
} as const);

export const RUNTIME_LIMITS = Object.freeze({
  "upload": {
    "authorizationSeconds": 300,
    "maximumAuthorizationSeconds": 900,
    "maximumChunkBytes": 8388608,
    "maximumAttachmentBytes": 20971520,
    "maximumRetentionDays": 3650,
    "retentionDays": {
      "import": 1,
      "aftersale": 365,
      "support": 365,
      "qualification": 3650
    }
  },
  "queue": {
    "maximumDepth": 4096,
    "reservedDepth": 1024,
    "lowPriority": 80,
    "deferred": [
      "export",
      "import",
      "maintenance"
    ],
    "protected": [
      "transaction",
      "payment",
      "inventory",
      "identity",
      "risk"
    ]
  },
  "cleanup": {
    "batch": 500,
    "objectConcurrency": 8,
    "inboxDays": 90,
    "outboxDays": 90
  },
  "worker": {
    "outbox": {
      "batch": 100,
      "concurrency": 8,
      "pollMilliseconds": 500
    },
    "scheduler": {
      "leaseSeconds": 45,
      "pollMilliseconds": 30000
    }
  },
  "voucherTender": {
    "holdTtlSeconds": 1800
  },
  "voucherExport": {
    "pageRows": 1000,
    "snapshotTtlSeconds": 86400,
    "downloadTtlSeconds": 300,
    "revealConcurrency": 16
  },
  "cart": {
    "maximumLines": 100,
    "maximumBatchItems": 100,
    "maximumQuantity": 999,
    "tokenBytes": 32
  },
  "checkout": {
    "quoteTtlSeconds": 900,
    "dependencyTimeoutMilliseconds": 500,
    "parallelConcurrency": 8,
    "maximumPriceDriftMinor": 0,
    "confirmationTokenBytes": 32
  },
  "risk": {
    "syncDeadlineMilliseconds": 80,
    "complexScoreRules": 20,
    "failClosed": [
      "high",
      "critical"
    ],
    "signalRetentionDays": {
      "public": 30,
      "personal": 7,
      "sensitive": 1
    }
  },
  "authentication": {
    "bootstrap": {
      "ttlSeconds": 600
    },
    "session": {
      "ttlSeconds": 7200
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
      "resendSeconds": 30,
      "maximumAttempts": 10
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
      "idleTransactionTimeoutMilliseconds": 15000,
      "jit": false
    },
    "command": {
      "maximumConnections": 20,
      "connectionTimeoutMilliseconds": 3000,
      "idleTimeoutMilliseconds": 30000,
      "statementTimeoutMilliseconds": 10000,
      "idleTransactionTimeoutMilliseconds": 15000,
      "jit": false
    },
    "worker": {
      "maximumConnections": 24,
      "connectionTimeoutMilliseconds": 5000,
      "idleTimeoutMilliseconds": 30000,
      "statementTimeoutMilliseconds": 120000,
      "idleTransactionTimeoutMilliseconds": 15000,
      "jit": false
    },
    "migration": {
      "maximumConnections": 1,
      "connectionTimeoutMilliseconds": 5000,
      "idleTimeoutMilliseconds": 30000,
      "statementTimeoutMilliseconds": 0,
      "idleTransactionTimeoutMilliseconds": 0,
      "jit": true
    }
  }
} as const);
