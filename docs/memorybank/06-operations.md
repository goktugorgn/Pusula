# Operations

## Installation

### Prerequisites

| Component       | Version            | Notes                   |
| --------------- | ------------------ | ----------------------- |
| Raspberry Pi OS | 64-bit (Bookworm+) | Lite or Desktop         |
| Node.js         | 20 LTS             | Enforced by installer   |
| Unbound         | 1.17+              | Via apt                 |
| unbound-control | Enabled            | Configured by installer |

### One-Command Install

```bash
curl -fsSL https://raw.githubusercontent.com/goktugorgn/Pusula/refs/heads/main/scripts/install.sh | sudo bash
```

### Manual Installation

```bash
# 1. Clone repository
git clone https://github.com/goktugorgn/Pusula.git
cd Pusula

# 2. Run installer
sudo ./scripts/install.sh
```

> [!TIP]
> After installation, use the `pusula` CLI for service management. See [CLI Commands](#cli-commands) below.

---

## File Layout

### Configuration: /etc/pusula/

```
/etc/pusula/
├── config.yaml         # Server settings (640 root:pusula)
├── credentials.json    # bcrypt password hash (600 pusula:pusula)
├── upstream.json       # Upstream DNS config (640 pusula:pusula)
└── pusula.env          # Environment variables (640 root:pusula)
```

### Application: /opt/pusula/

```
/opt/pusula/
├── current/            # Symlink to active release
│   └── apps/
│       ├── backend/    # Node.js backend
│       │   ├── dist/
│       │   └── package.json
│       └── ui/
│           └── dist/   # Built React app
└── releases/           # Release directories
```

### Data: /var/lib/pusula/

```
/var/lib/pusula/
├── alerts.json         # Persisted alerts (660 pusula:pusula)
└── backups/            # Config snapshots (750 pusula:pusula)
```

### Logs: /var/log/pusula/

```
/var/log/pusula/
└── audit.log           # Security audit trail (640 pusula:adm)
```

---

## Systemd Services

### pusula.service

Main backend service. Serves both API and static UI.

```ini
[Unit]
Description=Pusula DNS Management Backend
After=network.target unbound.service

[Service]
Type=simple
User=pusula
Group=pusula
WorkingDirectory=/opt/pusula/current/apps/backend
EnvironmentFile=/etc/pusula/pusula.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

# Security hardening
# NoNewPrivileges disabled to allow sudo execution
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/etc/pusula /var/log/pusula /var/lib/pusula

[Install]
WantedBy=multi-user.target
```

### pusula-doh-proxy.service (Optional)

DNS-over-HTTPS proxy using cloudflared. **Disabled by default.**

Enable only when DoH mode is selected:

```bash
sudo systemctl enable pusula-doh-proxy
sudo systemctl start pusula-doh-proxy
```

---

## CLI Commands

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

# Monitoring
pusula health             # Check API health endpoint
pusula logs backend       # Backend logs
pusula logs unbound       # Unbound DNS logs
pusula logs proxy         # DoH proxy logs
pusula logs audit         # Audit log

# Information
pusula version            # Show version info
pusula help               # Show all commands
```

> [!NOTE]
> The CLI is installed to `/usr/local/bin/pusula` during installation.

---

## Least-Privilege Strategy

### Service User

- **Username**: `pusula`
- **Shell**: `/usr/sbin/nologin` (no login allowed)
- **Groups**: `unbound`, `adm` (supplementary)

### Sudoers Configuration

Limited sudo access via `/etc/sudoers.d/pusula`:

| Command                                   | Purpose              |
| ----------------------------------------- | -------------------- |
| `unbound-control status`                  | Check Unbound status |
| `unbound-control reload`                  | Reload config        |
| `unbound-control stats_noreset`           | Get statistics       |
| `unbound-checkconf`                       | Validate config      |
| `systemctl status/reload/restart unbound` | Service control      |

### Systemd Hardening

- `NoNewPrivileges=true` - Prevent privilege escalation
- `ProtectSystem=strict` - Mount filesystem read-only
- `ProtectHome=true` - Hide home directories
- `PrivateTmp=true` - Isolated /tmp
- `ReadWritePaths` - Explicit write paths only

---

## Upgrade Procedure

The installer supports idempotent upgrades:

```bash
# Re-run installer (preserves config)
sudo ./scripts/install.sh

# Or remote upgrade
curl -fsSL https://raw.githubusercontent.com/goktugorgn/Pusula/refs/heads/main/scripts/install.sh | sudo bash
```

Upgrades:

- Create new release in `/opt/pusula/releases/`
- Update `/opt/pusula/current` symlink
- Preserve `/etc/pusula/` configuration
- Restart service automatically

---

## Uninstall

### Standard Uninstall (preserve config)

```bash
sudo ./scripts/uninstall.sh
```

Removes:

- Service and systemd units
- CLI (`/usr/local/bin/pusula` and all other locations)
- Application (`/opt/pusula/`)
- Sudoers configuration
- Temp files (`/tmp/pusula*`)

Preserves:

- Configuration (`/etc/pusula/`)
- Backups (`/var/lib/pusula/`)

### Full Purge

```bash
sudo ./scripts/uninstall.sh --purge --yes
```

Removes everything including configuration, backups, and logs.

### Verify Complete Removal

```bash
sudo ./scripts/uninstall-selfcheck.sh
```

Checks all CLI locations, systemd units, directories, sudoers, and temp files.

---

## Related Documents

- [02-architecture.md](02-architecture.md) – System architecture
- [09-runbook.md](09-runbook.md) – Troubleshooting procedures
- [systemd/README.md](../../systemd/README.md) – Systemd unit documentation
