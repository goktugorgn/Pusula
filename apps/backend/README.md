# Pusula Backend

Node.js + TypeScript + Fastify backend for Unbound DNS management.

## Quick Start

### Development (Local)

```bash
cd apps/backend
npm install
npm run dev
```

The server starts at http://localhost:3000. Uses `config.yaml` in the current directory.

Test the health endpoint:

```bash
curl http://localhost:3000/api/health
```

### Production (Raspberry Pi)

```bash
# Build
npm run build

# Set environment
export NODE_ENV=production
export JWT_SECRET=$(openssl rand -base64 32)
export CONFIG_PATH=/etc/unbound-ui/config.yaml
export CREDENTIALS_PATH=/etc/unbound-ui/credentials.json

# Start
npm start
```

Or use the systemd service (see `systemd/unbound-ui-backend.service`).

---

## NPM Scripts

| Script              | Description                       |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start with hot-reload (tsx watch) |
| `npm run build`     | Compile TypeScript to `dist/`     |
| `npm start`         | Run production build              |
| `npm test`          | Run unit tests                    |
| `npm run lint`      | Lint source files                 |
| `npm run lint:fix`  | Fix auto-fixable lint issues      |
| `npm run format`    | Format code with Prettier         |
| `npm run typecheck` | Type-check without emitting       |

---

## API Endpoints

| Method | Path                        | Auth | Description            |
| ------ | --------------------------- | ---- | ---------------------- |
| GET    | `/api/health`               | No   | Health check           |
| POST   | `/api/login`                | No   | Authenticate           |
| POST   | `/api/user/change-password` | Yes  | Change password        |
| GET    | `/api/unbound/status`       | Yes  | Unbound status         |
| GET    | `/api/unbound/stats`        | Yes  | Resolver statistics    |
| GET    | `/api/unbound/logs`         | Yes  | Query logs             |
| POST   | `/api/unbound/reload`       | Yes  | Reload config          |
| POST   | `/api/unbound/restart`      | Yes  | Restart service        |
| POST   | `/api/unbound/flush`        | Yes  | Flush DNS cache        |
| GET    | `/api/upstream`             | Yes  | Get upstream config    |
| PUT    | `/api/upstream`             | Yes  | Update upstream config |
| POST   | `/api/self-test`            | Yes  | Run diagnostics        |
| GET    | `/api/alerts`               | Yes  | List active alerts     |
| POST   | `/api/alerts/ack`           | Yes  | Acknowledge alert      |
| GET    | `/api/pihole/summary`       | Yes  | Pi-hole stats          |

---

## Configuration

Priority: `CONFIG_PATH` env var > `/etc/unbound-ui/config.yaml` > `./config.yaml`

See `config.yaml` for available options.

---

## Security

### Authentication

- **Single-user model**: Username `admin` (configurable)
- **Password hashing**: bcrypt with 12 rounds
- **Session**: JWT with httpOnly, secure, sameSite=strict cookie
- **Token expiry**: 24 hours

### Rate Limiting

| Scope          | Limit | Window   |
| -------------- | ----- | -------- |
| `/api/login`   | 5     | 1 minute |
| Other `/api/*` | 60    | 1 minute |

### Brute-Force Lockout (per IP)

| Failed Attempts | Lockout Duration |
| --------------- | ---------------- |
| 5               | 15 minutes       |
| 10              | 1 hour           |

Clear error messages returned without leaking sensitive details.

### Audit Logging

JSON-lines log at `/var/log/unbound-ui/audit.log` (or `./audit.log` in dev):

```json
{
  "timestamp": "2026-01-17T18:00:00.000Z",
  "event": "login_success",
  "actor": { "ip": "192.168.1.100", "user": "admin", "userAgent": "Mozilla/5.0" },
  "result": "success"
}
```

**Logged events**: `login_success`, `login_failure`, `password_change`, `config_apply`, `config_rollback`, `service_reload`, `service_restart`, `cache_flush`, `alert_ack`, `self_test`

### Command Execution

- All commands are allowlisted (no shell injection possible)
- Uses `spawn()` with explicit argv arrays
- Parameters validated with strict regex patterns

---

## Project Structure

```
src/
├── config/       # Config loader + Zod schemas
├── routes/       # API route handlers
├── services/     # Business logic
├── security/     # Auth, rate limit, audit
└── utils/        # SafeExec, errors
```

---

## Testing

```bash
npm test        # Run all tests
npm run test:watch  # Watch mode
```

### Test Coverage (137+ tests)

| Test File                 | Description                             |
| ------------------------- | --------------------------------------- |
| `auth.test.ts`            | Password hashing, JWT verification      |
| `lockout.test.ts`         | Brute-force protection                  |
| `safeExec.test.ts`        | Command allowlist, parameter validation |
| `auditLogger.test.ts`     | Audit log writes                        |
| `configManager.test.ts`   | Config rendering, schema validation     |
| `atomicWrite.test.ts`     | Atomic file operations                  |
| `applyWorkflow.test.ts`   | Apply/rollback workflow                 |
| `selfTest.test.ts`        | Diagnostic step structures              |
| `alertStore.test.ts`      | Alert storage and thresholds            |
| `piholeClient.test.ts`    | Pi-hole API parsing                     |
| `logReader.test.ts`       | Log parsing and filtering               |
| `unboundControl.test.ts`  | Stats parsing                           |
| `actionEndpoints.test.ts` | Route validation                        |
