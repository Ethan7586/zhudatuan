// Generated from config/telemetry.yml. Do not edit.
export const REDACTION_KEYS = Object.freeze([
  "authorization",
  "address",
  "apikey",
  "attachment",
  "body",
  "callback",
  "cardcode",
  "cardsecret",
  "challenge",
  "ciphertext",
  "claim",
  "code",
  "cookie",
  "credential",
  "csrf",
  "destination",
  "email",
  "evidence",
  "filename",
  "invite",
  "message",
  "mobile",
  "nonce",
  "objectref",
  "otp",
  "password",
  "phone",
  "preauth",
  "privatekey",
  "proof",
  "recipient",
  "secret",
  "token",
  "tokenhash"
] as const);

export const REDACTION_KEY_PATTERN = new RegExp(`(?:${REDACTION_KEYS.join('|')})`, 'i');

export const TELEMETRY_METRICS = Object.freeze({
  "approval": [
    "template",
    "state",
    "decision",
    "durationms",
    "outcome"
  ],
  "voucherbatch": [
    "kind",
    "state",
    "total",
    "succeeded",
    "failed",
    "durationms"
  ],
  "importing": [
    "kind",
    "phase",
    "total",
    "accepted",
    "rejected",
    "duplicate",
    "durationms"
  ],
  "reconciliation": [
    "provider",
    "state",
    "matched",
    "differences",
    "durationms"
  ],
  "providercapability": [
    "provider",
    "capability",
    "operation",
    "outcome",
    "durationms"
  ],
  "webvitals": [
    "surface",
    "routeid",
    "metric",
    "value",
    "rating",
    "navigationtype"
  ]
} as const);

export const TELEMETRY_BUFFER = Object.freeze({
  "capacity": 20000,
  "retentionSeconds": 3600,
  "maximumRead": 5000
} as const);

export const TELEMETRY_HEALTH = Object.freeze({
  "freshnessSeconds": 300,
  "queueBacklogDepth": 1000,
  "checks": [
    "dependency",
    "queue",
    "provider",
    "servicelevel",
    "release"
  ]
} as const);

export const TELEMETRY_SLO = Object.freeze({
  "catalogP95Ms": 150,
  "queryP95Ms": 300,
  "detailP95Ms": 500,
  "applicationListP95Ms": 250,
  "entryCacheHitP95Ms": 20,
  "entryDatabaseP95Ms": 80,
  "bootstrapP95Ms": 300,
  "qrEncodeP95Ms": 30,
  "qrBundleGzipKb": 100,
  "commandP95Ms": 800,
  "employeeInvitationCreateP95Ms": 300,
  "invitationResolveP95Ms": 300,
  "enrollmentCompleteP95Ms": 800,
  "supportMessageSendP95Ms": 300,
  "supportConversationP95Ms": 500,
  "supportQueueP95Ms": 500,
  "supportEventDeliveryP95Ms": 1000,
  "orderP95Ms": 1500,
  "webhookDurableAcceptP99Ms": 500,
  "outboxP99Seconds": 30,
  "availabilityPercent": 99.95,
  "rpoMinutes": 0,
  "rtoMinutes": 15
} as const);

export const TELEMETRY_SERVICE_LEVELS = Object.freeze({
  "operationavailability": {
    "title": "核心操作可用率",
    "indicator": {
      "metric": "commerce.operation.count",
      "type": "ratio",
      "goodResult": "success"
    },
    "unit": "percent",
    "direction": "minimum",
    "windowSeconds": 300,
    "severity": "critical",
    "owner": "reliability",
    "runbook": "docs/operations/deployment.md",
    "target": 99.95
  },
  "operationlatency": {
    "title": "核心操作 P95 延迟",
    "indicator": {
      "metric": "commerce.operation.duration",
      "type": "percentile",
      "percentile": 95
    },
    "unit": "milliseconds",
    "direction": "maximum",
    "windowSeconds": 300,
    "severity": "warning",
    "owner": "reliability",
    "runbook": "docs/operations/deployment.md",
    "target": 800
  },
  "outboxlatency": {
    "title": "Outbox P99 延迟",
    "indicator": {
      "metric": "commerce.outbox.lag",
      "type": "percentile",
      "percentile": 99
    },
    "unit": "seconds",
    "direction": "maximum",
    "windowSeconds": 300,
    "severity": "critical",
    "owner": "runtime",
    "runbook": "docs/operations/projection.md",
    "target": 30
  }
} as const);

export const TELEMETRY_ALERTS = Object.freeze({
  "entryfailure": {
    "title": "商城入口失败率过高",
    "signal": "experience.entry.resolve.failure",
    "measure": "percent",
    "windowSeconds": 300,
    "threshold": 1,
    "severity": "critical",
    "owner": "experience",
    "runbook": "docs/operations/mallentry.md"
  },
  "entryinvalid": {
    "title": "商城入口配置无效",
    "signal": "experience.entry.invalid",
    "measure": "count",
    "windowSeconds": 60,
    "threshold": 0,
    "severity": "critical",
    "owner": "experience",
    "runbook": "docs/operations/mallentry.md"
  },
  "sessionmallmismatch": {
    "title": "会话商城范围不匹配",
    "signal": "identity.session.mallmismatch",
    "measure": "count",
    "windowSeconds": 300,
    "threshold": 20,
    "severity": "warning",
    "owner": "identity",
    "runbook": "docs/operations/sessioncompromise.md"
  },
  "approvaloverdue": {
    "title": "审批任务超时",
    "signal": "approval.task.overdue",
    "measure": "count",
    "windowSeconds": 300,
    "threshold": 0,
    "severity": "warning",
    "owner": "approval",
    "runbook": "docs/operations/approval.md"
  },
  "voucherbatchfailure": {
    "title": "卡券批次失败率过高",
    "signal": "voucher.batch.failure",
    "measure": "percent",
    "windowSeconds": 300,
    "threshold": 1,
    "severity": "critical",
    "owner": "voucher",
    "runbook": "docs/operations/voucherissue.md"
  },
  "importfailure": {
    "title": "导入失败率过高",
    "signal": "runtime.import.failure",
    "measure": "percent",
    "windowSeconds": 300,
    "threshold": 1,
    "severity": "warning",
    "owner": "runtime",
    "runbook": "docs/operations/catalogimport.md"
  },
  "reconciliationdifference": {
    "title": "对账差异未清零",
    "signal": "finance.reconciliation.difference",
    "measure": "count",
    "windowSeconds": 900,
    "threshold": 0,
    "severity": "critical",
    "owner": "finance",
    "runbook": "docs/operations/reconciliation.md"
  },
  "providercapabilityfailure": {
    "title": "Provider 能力失败率过高",
    "signal": "extension.provider.failure",
    "measure": "percent",
    "windowSeconds": 300,
    "threshold": 5,
    "severity": "warning",
    "owner": "extension",
    "runbook": "docs/operations/providerhealth.md"
  },
  "servicelevelburn": {
    "title": "核心操作错误预算消耗过快",
    "signal": "slo.operationavailability",
    "measure": "burnrate",
    "windowSeconds": 300,
    "threshold": 2,
    "severity": "critical",
    "owner": "reliability",
    "runbook": "docs/operations/deployment.md"
  }
} as const);

export const TELEMETRY_SAMPLING = Object.freeze({
  "errors": 1,
  "critical": 1,
  "commands": 1,
  "reads": 0.1,
  "webvitals": 1,
  "providerhealth": 0.1
} as const);
