# Operations

## Installation

### Prerequisites

| Component       | Version            | Notes                      |
| --------------- | ------------------ | -------------------------- |
| Raspberry Pi OS | 64-bit (Bookworm+) | Lite or Desktop            |
| Node.js         | 18+ LTS            | Via NodeSource             |
| Unbound         | 1.17+              | Via apt                    |
| unbound-control | Enabled            | Configured with local keys |

### One-Command Install

```bash
curl -fsSL https://raw.githubusercontent.com/goktugorgn/pusula/main/scripts/install.sh | sudo bash
```

### Manual Installation

```bash
# 1. Clone repository
git clone https://github.com/goktugorgn/pusula.git
cd pusula

# 2. Run installer
sudo ./scripts/install.sh
```

> [!TIP]
> After installation, use the `pusula` CLI for service management. See [CLI Commands](#cli-commands) below.

---

## File Layout

### Configuration: /etc/unbound-ui/

```
/etc/unbound-ui/
├── config.yaml         # Server settings, Pi-hole config (640 root:unbound-ui)
├── credentials.json    # bcrypt password hash (600 unbound-ui:unbound-ui)
└── unbound-ui.env      # Environment variables (600 root:unbound-ui)
```

### Application: /opt/pusula/

```
/opt/pusula/
├── apps/
│   ├── backend/        # Node.js backend (755 root:root)
│   │   ├── dist/       # Compiled TypeScript
│   │   └── package.json
│   └── ui/
│       └── dist/       # Built React app
├── scripts/            # Installer, CLI
└── systemd/            # Service files
```

### Data: /var/lib/unbound-ui/

```
/var/lib/unbound-ui/
├── alerts.json         # Persisted alerts (660 unbound-ui:unbound-ui)
└── backups/            # Config snapshots (750 unbound-ui:unbound-ui)
    └── 20260117T143000Z/
```

### Logs: /var/log/unbound-ui/

```
/var/log/unbound-ui/
└── audit.log           # Security audit trail (640 unbound-ui:adm)
```

---

## Systemd Services

### unbound-ui-backend.service

```ini
# /etc/systemd/system/unbound-ui-backend.service
[Unit]
Description=Pusula DNS Management Backend
Documentation=https://github.com/admin/pusula
After=network.target unbound.service
Wants=unbound.service

[Service]
Type=simple
User=unbound-ui
Group=unbound-ui
WorkingDirectory=/opt/pusula/backend
EnvironmentFile=/etc/unbound-ui/unbound-ui.env
ExecStart=/usr/bin/node dist/server.js

# Restart policy
Restart=on-failure
RestartSec=5
StartLimitBurst=3
StartLimitIntervalSec=60

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictRealtime=true
RestrictSUIDSGID=true

# Allow write to specific paths
ReadWritePaths=/var/lib/unbound-ui
ReadWritePaths=/var/log/unbound-ui
ReadWritePaths=/etc/unbound/unbound-ui-managed.conf

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=unbound-ui

[Install]
WantedBy=multi-user.target
```

### unbound-ui-doh-proxy.service (Optional)

```ini
# /etc/systemd/system/unbound-ui-doh-proxy.service
[Unit]
Description=DNS-over-HTTPS Proxy for Pusula
Documentation=https://github.com/cloudflare/cloudflared
After=network.target
ConditionPathExists=/usr/local/bin/cloudflared

[Service]
Type=simple
User=unbound-ui
Group=unbound-ui
ExecStart=/usr/local/bin/cloudflared proxy-dns --port 5053 --upstream https://cloudflare-dns.com/dns-query

Restart=on-failure
RestartSec=5

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

> **Note**: DoH proxy is disabled by default. Enable only when DoH mode is selected in upstream configuration.

### Service Commands

```bash
# Status
sudo systemctl status unbound-ui-backend

# Start / Stop / Restart
sudo systemctl start unbound-ui-backend
sudo systemctl stop unbound-ui-backend
sudo systemctl restart unbound-ui-backend

# Enable on boot
sudo systemctl enable unbound-ui-backend

# View logs
sudo journalctl -u unbound-ui-backend -f

# DoH Proxy (if using DoH mode)
sudo systemctl enable unbound-ui-doh-proxy
sudo systemctl start unbound-ui-doh-proxy
```

### CLI Commands

The `pusula` CLI wrapper provides convenient commands for managing the service:

```bash
# Service management
sudo pusula start         # Start the backend
sudo pusula stop          # Stop the backend
sudo pusula restart       # Restart the backend
pusula status             # Show status of all services

# Autostart management
sudo pusula autostart on  # Enable autostart on boot
sudo pusula autostart off # Disable autostart on boot

# Log viewing (follow mode)
pusula logs backend       # Backend logs
pusula logs unbound       # Unbound DNS logs
pusula logs proxy         # DoH proxy logs
pusula logs audit         # Audit log

# Help
pusula help               # Show all commands
```

> [!NOTE]
> The CLI is installed to `/usr/local/bin/pusula` during installation.

---

## Least-Privilege Strategy

### Service User

```bash
# Create system user (no shell, no home)
useradd -r -s /usr/sbin/nologin -d /var/lib/unbound-ui -M unbound-ui

# Add to required groups
usermod -aG unbound unbound-ui   # Write to managed.conf
usermod -aG adm unbound-ui       # Read unbound logs
```

### Sudoers Configuration

```bash
# /etc/sudoers.d/unbound-ui
# Allow unbound-ui to run specific commands without password

# Unbound control commands
unbound-ui ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control status
unbound-ui ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control stats_noreset
unbound-ui ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control reload
unbound-ui ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control flush_zone *
unbound-ui ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control flush_requestlist

# Configuration validation
unbound-ui ALL=(ALL) NOPASSWD: /usr/sbin/unbound-checkconf

# Service management
unbound-ui ALL=(ALL) NOPASSWD: /bin/systemctl restart unbound
unbound-ui ALL=(ALL) NOPASSWD: /bin/systemctl reload unbound
unbound-ui ALL=(ALL) NOPASSWD: /bin/systemctl status unbound

# Log access
unbound-ui ALL=(ALL) NOPASSWD: /bin/journalctl -u unbound *
```

### File Permissions Summary

| Path                                   | Owner:Group           | Mode | Purpose                 |
| -------------------------------------- | --------------------- | ---- | ----------------------- |
| `/etc/unbound-ui/`                     | root:unbound-ui       | 750  | Configuration directory |
| `/etc/unbound-ui/config.yaml`          | root:unbound-ui       | 640  | Server settings         |
| `/etc/unbound-ui/credentials.json`     | unbound-ui:unbound-ui | 600  | Password hash           |
| `/etc/unbound-ui/unbound-ui.env`       | root:unbound-ui       | 640  | Environment vars        |
| `/var/lib/unbound-ui/`                 | unbound-ui:unbound-ui | 750  | Data directory          |
| `/var/log/unbound-ui/`                 | unbound-ui:adm        | 750  | Log directory           |
| `/etc/unbound/unbound-ui-managed.conf` | unbound:unbound       | 644  | Managed config          |
| `/opt/pusula/`                         | root:root             | 755  | Application             |

## Configuration

### Main Configuration File

```yaml
# /etc/unbound-ui/config.yaml
server:
  host: "0.0.0.0"
  port: 3000

pihole:
  enabled: false
  baseUrl: "http://localhost"
  apiToken: "" # Optional
```

### Credentials File

```json
// /etc/unbound-ui/credentials.json
{
  "username": "admin",
  "passwordHash": "$2b$12$..." // bcrypt hash
}
```

### Environment Variables

| Variable           | Description                |
| ------------------ | -------------------------- |
| `JWT_SECRET`       | JWT signing key (required) |
| `NODE_ENV`         | production / development   |
| `CONFIG_PATH`      | Path to config.yaml        |
| `CREDENTIALS_PATH` | Path to credentials.json   |

---

## Backup & Restore

### Automatic Snapshots

Snapshots are created automatically before every configuration change:

```
/var/lib/unbound-ui/backups/
├── 20260117T143000Z/
│   ├── managed.conf
│   ├── upstream.json
│   └── metadata.json
└── ...
```

### Manual Backup

```bash
# Backup entire Pusula installation
sudo tar -czf pusula-backup-$(date +%Y%m%d).tar.gz \
  /etc/unbound-ui \
  /var/lib/unbound-ui \
  /etc/unbound/unbound-ui-managed.conf
```

### Restore Configuration

```bash
# Restore a snapshot
sudo cp /opt/pusula/snapshots/<snapshot>.conf \
  /etc/unbound/unbound.conf.d/10-forward.conf

# Validate and reload
sudo unbound-checkconf
sudo unbound-control reload
```

---

## Upgrades

### Standard Upgrade

```bash
cd /opt/pusula
sudo git pull origin main
sudo npm install --prefix backend
sudo systemctl restart pusula
```

### Migration Notes

Breaking changes will be documented in [10-changelog.md](10-changelog.md).

---

## Monitoring

### Health Endpoints

| Endpoint                  | Purpose                |
| ------------------------- | ---------------------- |
| `GET /api/health`         | Backend liveness       |
| `GET /api/unbound/status` | Unbound service status |

### Log Locations

| Log            | Path                               |
| -------------- | ---------------------------------- |
| Pusula backend | `journalctl -u unbound-ui-backend` |
| Audit log      | `/var/log/unbound-ui/audit.log`    |
| Alerts store   | `/var/lib/unbound-ui/alerts.json`  |
| Unbound        | `/var/log/unbound/unbound.log`     |

### Metrics to Watch

| Metric           | Warning Threshold |
| ---------------- | ----------------- |
| Cache hit ratio  | < 50%             |
| SERVFAIL rate    | > 5%              |
| Upstream latency | > 500ms           |
| Query rate       | Sudden drops      |

---

## Troubleshooting

### Common Issues

| Symptom                | Check                | Solution                                   |
| ---------------------- | -------------------- | ------------------------------------------ |
| Cannot login           | Rate limit / lockout | Wait or check `/opt/pusula/logs/audit.log` |
| Config not applying    | Validation errors    | Check `unbound-checkconf` output           |
| Unbound not responding | Service status       | `systemctl status unbound`                 |
| High SERVFAIL rate     | Upstream issues      | Run self-test, check upstreams             |

### Debug Mode

```bash
# Run backend with debug logging
sudo DEBUG=pusula:* node /opt/pusula/backend/src/index.js
```

---

## Local macOS DEV Mode

> [!NOTE]
> DEV mode allows running Pusula on macOS without Unbound, systemd, or journalctl. Ideal for UI development and testing.

### Prerequisites

| Component | Version | Notes                  |
| --------- | ------- | ---------------------- |
| macOS     | 12+     | Apple Silicon or Intel |
| Node.js   | 18+ LTS | Via nvm or Homebrew    |
| npm       | 9+      | Included with Node.js  |

### DEV Mode Environment

Set `UNBOUND_UI_ENV=dev` to enable mock system layer:

```bash
# In apps/backend/.env
UNBOUND_UI_ENV=dev
PORT=3000
JWT_SECRET=dev-secret-change-in-prod
CONFIG_PATH=.local-dev/etc/unbound-ui/config.yaml
CREDENTIALS_PATH=.local-dev/etc/unbound-ui/credentials.json
UPSTREAM_PATH=.local-dev/var/lib/unbound-ui/upstream.json
BACKUP_DIR=.local-dev/var/lib/unbound-ui/backups
AUDIT_LOG_PATH=.local-dev/var/log/unbound-ui/audit.log
ALERTS_PATH=.local-dev/var/lib/unbound-ui/alerts.json
```

### DEV Directory Structure

```
.local-dev/                        # Runtime data (gitignored)
├── etc/unbound-ui/
│   ├── config.yaml                # Server config
│   └── credentials.json           # Dev credentials
└── var/
    ├── lib/unbound-ui/
    │   ├── upstream.json          # Upstream config
    │   ├── alerts.json            # Persisted alerts
    │   └── backups/               # Config snapshots
    └── log/unbound-ui/
        └── audit.log              # Audit log

apps/backend/mock-data/            # Static fixtures (in repo)
├── unbound-control/
│   ├── status.txt
│   └── stats_noreset.txt
├── systemctl/
│   ├── is-active-unbound.txt
│   └── status-unbound.txt
├── journalctl/
│   └── unbound.log
└── selftest/
    ├── pass.json
    └── fail.json
```

### Quick Start (macOS)

```bash
# 1. Clone and setup
git clone https://github.com/admin/pusula.git
cd pusula

# 2. Setup local dev environment
./scripts/setup-local-dev.sh

# 3. Install dependencies
cd apps/backend && npm install && cd ..
cd apps/ui && npm install && cd ..

# 4. Start backend (DEV mode)
cd apps/backend
cp .env.dev .env
npm run dev

# 5. Start UI (separate terminal)
cd apps/ui
npm run dev

# 6. Open browser
open http://localhost:5173
```

### DEV Mode Behavior

| Endpoint                    | DEV Behavior                     |
| --------------------------- | -------------------------------- |
| `GET /api/unbound/status`   | Returns mock status (running)    |
| `GET /api/unbound/stats`    | Returns parsed fixture data      |
| `GET /api/unbound/logs`     | Returns mock log entries         |
| `POST /api/unbound/reload`  | Logs action, returns success     |
| `POST /api/unbound/restart` | Logs action, returns success     |
| `POST /api/unbound/flush`   | Logs action, returns success     |
| `PUT /api/upstream`         | Writes to `.local-dev/`, success |
| `POST /api/self-test`       | Returns mock test results        |
| `GET /api/pihole/summary`   | Returns `configured: false`      |

### Smoke Test

```bash
./scripts/local-smoke-test.sh
```

---

## Related Documents

- [09-runbook.md](09-runbook.md) – Detailed operational procedures
- [05-security.md](05-security.md) – Security operations
- [07-testing.md](07-testing.md) – Self-test procedures
