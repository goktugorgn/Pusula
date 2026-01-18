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
curl -fsSL https://raw.githubusercontent.com/goktugorgn/pusula/main/install.sh | sudo bash
```

### Manual Installation

```bash
# 1. Clone repository
git clone https://github.com/goktugorgn/pusula.git
cd pusula

# 2. Run installer
sudo ./scripts/install.sh

# 3. Configure (interactive)
sudo pusula-setup
```

---

## Systemd Services

### Pusula Backend

```ini
# /etc/systemd/system/pusula.service
[Unit]
Description=Pusula DNS Management Backend
After=network.target unbound.service

[Service]
Type=simple
User=pusula
WorkingDirectory=/opt/pusula/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Service Commands

```bash
# Status
sudo systemctl status pusula

# Start / Stop / Restart
sudo systemctl start pusula
sudo systemctl stop pusula
sudo systemctl restart pusula

# Enable on boot
sudo systemctl enable pusula

# View logs
sudo journalctl -u pusula -f
```

---

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
  "username": "goktugorgn",
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

| Log            | Path                              |
| -------------- | --------------------------------- |
| Pusula backend | `journalctl -u pusula`            |
| Audit log      | `/var/log/unbound-ui/audit.log`   |
| Alerts store   | `/var/lib/unbound-ui/alerts.json` |
| Unbound        | `/var/log/unbound/unbound.log`    |

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

## Related Documents

- [09-runbook.md](09-runbook.md) – Detailed operational procedures
- [05-security.md](05-security.md) – Security operations
- [07-testing.md](07-testing.md) – Self-test procedures
