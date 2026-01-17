# Pusula Backend - Implementation Plan

> **Status**: 📋 PLANNING (not yet implemented)
>
> This document outlines the planned implementation. Code will be written after approval.

---

## Overview

Node.js + Fastify backend agent for Unbound DNS management on Raspberry Pi OS.

**Source of Truth**: [docs/memorybank/\*](../docs/memorybank/) and [docs/api/openapi.yaml](../docs/api/openapi.yaml)

---

## 1. Folder Structure

```
apps/backend/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
│
├── src/
│   ├── index.ts                 # Server entry point
│   ├── server.ts                # Fastify configuration
│   │
│   ├── config/
│   │   ├── index.ts             # Config loader (YAML + env)
│   │   └── schema.ts            # Zod validation schemas
│   │
│   ├── routes/
│   │   ├── auth.ts              # POST /login, /user/change-password
│   │   ├── health.ts            # GET /health (public)
│   │   ├── unbound.ts           # GET/POST /unbound/*
│   │   ├── upstream.ts          # GET/PUT /upstream, POST /self-test
│   │   ├── alerts.ts            # GET/POST /alerts/*
│   │   └── pihole.ts            # GET /pihole/summary
│   │
│   ├── services/
│   │   ├── unboundControl.ts    # Wrapper for unbound-control
│   │   ├── configManager.ts     # Snapshot/apply/rollback logic
│   │   ├── logReader.ts         # journalctl integration
│   │   ├── selfTest.ts          # 4-step validation engine
│   │   ├── alertEngine.ts       # Rule-based alerting
│   │   └── piholeClient.ts      # Pi-hole API consumer
│   │
│   ├── security/
│   │   ├── auth.ts              # JWT sign/verify, password hashing
│   │   ├── rateLimit.ts         # IP-based sliding window limiter
│   │   ├── lockout.ts           # Brute-force protection
│   │   ├── auditLogger.ts       # JSON-lines audit log
│   │   └── validators.ts        # Request body/query validators
│   │
│   └── utils/
│       ├── safeExec.ts          # Allowlisted command executor
│       └── errors.ts            # Custom error types
│
└── tests/
    ├── auth.test.ts
    ├── lockout.test.ts
    ├── safeExec.test.ts
    └── configManager.test.ts
```

---

## 2. Key Modules/Services

| Module              | Responsibility                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `safeExec.ts`       | **CRITICAL**: Execute only allowlisted commands using `spawn()` with argv arrays. No shell, no user input interpolation. |
| `configManager.ts`  | Safe apply workflow: snapshot → validate → apply → reload → self-test → rollback on failure.                             |
| `unboundControl.ts` | Wrapper for `unbound-control` commands with parsed output.                                                               |
| `selfTest.ts`       | 4-step validation: config check, upstream connectivity, resolver function, health observation.                           |
| `alertEngine.ts`    | Monitor thresholds (SERVFAIL rate, cache ratio, service status) and emit alerts.                                         |
| `auditLogger.ts`    | Append-only JSON log for all state-changing actions.                                                                     |
| `rateLimit.ts`      | Per-IP sliding window rate limiter (5/min login, 60/min API).                                                            |
| `lockout.ts`        | IP-based lockout after 5 failures (15min) or 10 failures (1hr).                                                          |

---

## 3. Command Allowlist (Exact Commands)

```typescript
const ALLOWED_COMMANDS = {
  // Unbound control
  "unbound-status": { cmd: "unbound-control", args: ["status"] },
  "unbound-stats": { cmd: "unbound-control", args: ["stats_noreset"] },
  "unbound-reload": { cmd: "unbound-control", args: ["reload"] },
  "unbound-flush-all": { cmd: "unbound-control", args: ["flush_zone", "."] },
  "unbound-flush-zone": {
    cmd: "unbound-control",
    args: ["flush_zone", "$ZONE"],
  },
  "unbound-checkconf": { cmd: "unbound-checkconf", args: [] },

  // Systemctl (restricted services)
  "systemctl-is-active": { cmd: "systemctl", args: ["is-active", "$SERVICE"] },
  "systemctl-status": {
    cmd: "systemctl",
    args: ["status", "$SERVICE", "--no-pager"],
  },
  "systemctl-reload": { cmd: "systemctl", args: ["reload", "$SERVICE"] },
  "systemctl-restart": { cmd: "systemctl", args: ["restart", "$SERVICE"] },

  // Journal reading (read-only)
  "journalctl-read": {
    cmd: "journalctl",
    args: ["-u", "$UNIT", "--no-pager", "-n", "$LINES", "-o", "json"],
  },
  "journalctl-since": {
    cmd: "journalctl",
    args: ["-u", "$UNIT", "--no-pager", "--since", "$SINCE", "-o", "json"],
  },
};

// Parameter validation patterns
const VALIDATORS = {
  ZONE: /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.?$/,
  SERVICE: /^(unbound|cloudflared|dnscrypt-proxy)$/,
  UNIT: /^(unbound|unbound-ui|cloudflared|dnscrypt-proxy)$/,
  LINES: /^\d{1,4}$/,
  SINCE: /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/,
};
```

> ⚠️ **No user input is ever interpolated into shell strings.** All execution uses `spawn()` with explicit argv arrays.

---

## 4. Config File Formats and Paths

### `/etc/unbound-ui/config.yaml`

```yaml
server:
  port: 3000
  host: 0.0.0.0

unbound:
  managedIncludePath: /etc/unbound/unbound-ui-managed.conf

rateLimit:
  login: { max: 5, windowMs: 60000 }
  api: { max: 60, windowMs: 60000 }

lockout:
  threshold: 5
  durationMs: 900000 # 15 min
  extendedThreshold: 10
  extendedDurationMs: 3600000 # 1 hr

pihole:
  enabled: false
  baseUrl: http://localhost/admin/api.php
```

### `/etc/unbound-ui/credentials.json`

```json
{
  "username": "goktugorgn",
  "passwordHash": "$argon2id$v=19$m=65536,t=3,p=4$..."
}
```

### `/var/lib/unbound-ui/upstream.json`

```json
{
  "mode": "dot",
  "dotProviders": [
    {
      "id": "cf-1",
      "address": "1.1.1.1",
      "port": 853,
      "sni": "cloudflare-dns.com",
      "enabled": true
    }
  ],
  "dohProviders": []
}
```

### File Paths Summary

| Path                                   | Purpose                 | Permissions           |
| -------------------------------------- | ----------------------- | --------------------- |
| `/etc/unbound-ui/config.yaml`          | App config              | 640 (root:unbound-ui) |
| `/etc/unbound-ui/credentials.json`     | Password hash           | 600 (root:unbound-ui) |
| `/var/lib/unbound-ui/upstream.json`    | Upstream config         | 644 (unbound-ui)      |
| `/var/lib/unbound-ui/backups/`         | Config snapshots        | 755 (unbound-ui)      |
| `/var/log/unbound-ui/audit.log`        | Audit trail             | 640 (unbound-ui)      |
| `/etc/unbound/unbound-ui-managed.conf` | Managed Unbound include | 644 (root:unbound)    |

---

## 5. Security Approach

### Authentication

- **Single-user model**: username stored in `credentials.json`
- **Password hashing**: Argon2id (per SSOT) or bcrypt as fallback
- **Session**: JWT with `httpOnly`, `secure`, `sameSite=strict` cookie
- **Token expiry**: 24 hours (configurable)

### Rate Limiting

| Scope                 | Limit | Window   |
| --------------------- | ----- | -------- |
| Login attempts per IP | 5     | 1 minute |
| API calls per token   | 60    | 1 minute |

### Brute-Force Lockout

| Trigger          | Duration   |
| ---------------- | ---------- |
| 5 failed logins  | 15 minutes |
| 10 failed logins | 1 hour     |

> Lockout is **per-IP**, not per-account (prevents attacker from locking victim).

### Audit Logging

All state-changing actions logged to `/var/log/unbound-ui/audit.log`:

```json
{
  "timestamp": "2026-01-17T18:00:00Z",
  "event": "config_apply",
  "actor": { "ip": "192.168.1.100", "user": "goktugorgn" },
  "details": { "mode": "dot", "snapshotId": "snapshot-2026-01-17T..." },
  "result": "success"
}
```

**Logged events**: login success/failure, password change, config apply/rollback, mode change, upstream change, service reload/restart, cache flush, alert acknowledgment.

---

## 6. API Endpoints (15 total)

| Method | Path                        | Auth | Handler     |
| ------ | --------------------------- | ---- | ----------- |
| POST   | `/api/login`                | No   | auth.ts     |
| POST   | `/api/user/change-password` | Yes  | auth.ts     |
| GET    | `/api/health`               | No   | health.ts   |
| GET    | `/api/unbound/status`       | Yes  | unbound.ts  |
| GET    | `/api/unbound/stats`        | Yes  | unbound.ts  |
| GET    | `/api/unbound/logs`         | Yes  | unbound.ts  |
| POST   | `/api/unbound/reload`       | Yes  | unbound.ts  |
| POST   | `/api/unbound/restart`      | Yes  | unbound.ts  |
| POST   | `/api/unbound/flush`        | Yes  | unbound.ts  |
| GET    | `/api/upstream`             | Yes  | upstream.ts |
| PUT    | `/api/upstream`             | Yes  | upstream.ts |
| POST   | `/api/self-test`            | Yes  | upstream.ts |
| GET    | `/api/alerts`               | Yes  | alerts.ts   |
| POST   | `/api/alerts/ack`           | Yes  | alerts.ts   |
| GET    | `/api/pihole/summary`       | Yes  | pihole.ts   |

---

## 7. Development Workflow

```bash
# Install dependencies
npm install

# Development (with watch)
npm run dev

# Build for production
npm run build

# Run production
npm start

# Run tests
npm test
```

---

## 8. Verification Plan

### Unit Tests

- [ ] `safeExec.ts` - Command allowlist enforcement
- [ ] `lockout.ts` - Brute-force protection logic
- [ ] `auth.ts` - Password hashing
- [ ] `configManager.ts` - Snapshot/rollback

### Integration Tests (on Pi)

- [ ] All 15 API endpoints return expected responses
- [ ] Rate limiting triggers at threshold
- [ ] Lockout triggers after 5 failures
- [ ] Config apply with rollback on failure

### Manual Verification

- [ ] Audit log captures all state changes
- [ ] No command injection possible via any parameter

---

## Next Steps

1. ✅ Review and approve this plan
2. ⏳ Implement code per plan
3. ⏳ Write tests
4. ⏳ Deploy and verify on Raspberry Pi
