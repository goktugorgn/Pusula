# Pusula Backend

Node.js + Fastify backend for Unbound DNS management on Raspberry Pi OS.

## Features

- 🔐 **Secure authentication** with bcrypt, JWT, rate limiting, and brute-force protection
- 🛡️ **Allowlisted commands only** - no shell injection possible
- 📝 **Audit logging** for all state-changing actions
- 🔄 **Safe config workflow** - snapshot → validate → apply → self-test → rollback
- 📊 **Real-time metrics** from Unbound via `unbound-control`
- 🚨 **Alert engine** for service health monitoring
- 🕳️ **Pi-hole integration** (read-only)

## Quick Start

### Prerequisites

- Node.js 18+ LTS
- Unbound with `unbound-control` enabled
- Optional: cloudflared or dnscrypt-proxy for DoH

### Installation

```bash
cd backend
npm install
```

### Configuration

1. Create configuration directory:

```bash
sudo mkdir -p /etc/unbound-ui
sudo mkdir -p /var/lib/unbound-ui/backups
sudo mkdir -p /var/log/unbound-ui
```

2. Create credentials file:

```bash
# Generate password hash
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('your-password', 12).then(console.log)"

# Create credentials.json
sudo tee /etc/unbound-ui/credentials.json << 'EOF'
{
  "username": "admin",
  "passwordHash": "$2b$12$YOUR_HASH_HERE"
}
EOF
sudo chmod 600 /etc/unbound-ui/credentials.json
```

3. Create config file (optional):

```bash
sudo tee /etc/unbound-ui/config.yaml << 'EOF'
server:
  port: 3000
  host: 0.0.0.0

unbound:
  managedIncludePath: /etc/unbound/unbound-ui-managed.conf

pihole:
  enabled: true
  baseUrl: http://localhost/admin/api.php
EOF
```

4. Set environment variables:

```bash
cp .env.example .env
# Edit .env with your JWT_SECRET
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

| Method | Path                      | Description            |
| ------ | ------------------------- | ---------------------- |
| POST   | /api/login                | Authenticate           |
| POST   | /api/user/change-password | Change password        |
| GET    | /api/health               | Health check (public)  |
| GET    | /api/unbound/status       | Unbound status         |
| GET    | /api/unbound/stats        | Query statistics       |
| GET    | /api/unbound/logs         | Log entries            |
| POST   | /api/unbound/reload       | Reload config          |
| POST   | /api/unbound/restart      | Restart service        |
| POST   | /api/unbound/flush        | Flush cache            |
| GET    | /api/upstream             | Get upstream config    |
| PUT    | /api/upstream             | Update upstream config |
| POST   | /api/self-test            | Run self-test          |
| GET    | /api/alerts               | Active alerts          |
| POST   | /api/alerts/ack           | Acknowledge alert      |
| GET    | /api/pihole/summary       | Pi-hole stats          |

## Security

### Allowlisted Commands

Only these commands can be executed:

- `unbound-control status|stats_noreset|reload|flush_zone`
- `unbound-checkconf`
- `systemctl is-active|status|reload|restart` (for unbound, cloudflared)
- `journalctl -u <unit>` (for logs)

**No user input is ever interpolated into shell commands.**

### Rate Limiting

- Login: 5 attempts per minute per IP
- API: 60 requests per minute per IP

### Brute-Force Protection

- 5 failed logins → 15 minute lockout
- 10 failed logins → 1 hour lockout

### Audit Logging

All state-changing actions logged to `/var/log/unbound-ui/audit.log`:

- Login success/failure
- Password changes
- Config apply/rollback
- Mode changes
- Service reload/restart
- Cache flush
- Alert acknowledgments

## Project Structure

```
src/
├── index.ts              # Entry point
├── server.ts             # Fastify server setup
├── config/
│   ├── index.ts          # Config loader
│   └── schema.ts         # Validation schemas
├── routes/
│   ├── auth.ts           # Authentication
│   ├── health.ts         # Health check
│   ├── unbound.ts        # Unbound management
│   ├── upstream.ts       # Upstream config
│   ├── alerts.ts         # Alert management
│   └── pihole.ts         # Pi-hole integration
├── services/
│   ├── unboundControl.ts # Unbound wrapper
│   ├── configManager.ts  # Config management
│   ├── logReader.ts      # Log reading
│   ├── selfTest.ts       # Self-test engine
│   ├── alertEngine.ts    # Alert monitoring
│   └── piholeClient.ts   # Pi-hole client
├── security/
│   ├── auth.ts           # JWT auth
│   ├── rateLimit.ts      # Rate limiting
│   ├── lockout.ts        # Brute-force protection
│   ├── auditLogger.ts    # Audit logging
│   └── validators.ts     # Request validation
└── utils/
    ├── safeExec.ts       # Allowlisted commands
    └── errors.ts         # Error types
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## License

MIT
