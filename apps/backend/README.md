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

- **Auth**: Argon2id password hashing, JWT with httpOnly cookies
- **Rate limit**: 5/min login, 60/min API
- **Lockout**: 5 failures → 15min, 10 → 1hr (per IP)
- **Audit**: All state changes logged to `/var/log/unbound-ui/audit.log`
- **Commands**: Allowlisted only (no shell injection possible)

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
