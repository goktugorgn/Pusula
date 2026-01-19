# Pusula Systemd Units

This directory contains systemd service unit files for running Pusula on Linux systems.

## Services

### pusula.service

The main Pusula backend service. This serves both the API and the static UI.

**Features:**

- Runs as unprivileged `pusula` user
- Security hardening enabled (NoNewPrivileges, ProtectSystem, etc.)
- Automatic restart on failure
- Logs to journald

**Install:**

```bash
sudo cp pusula.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pusula
sudo systemctl start pusula
```

### pusula-doh-proxy.service (Optional)

DNS-over-HTTPS proxy using cloudflared. **Disabled by default.**

Only enable when:

- DoH mode is selected in upstream configuration
- cloudflared is installed at `/usr/local/bin/cloudflared`

**Install:**

```bash
sudo cp pusula-doh-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pusula-doh-proxy
sudo systemctl start pusula-doh-proxy
```

## Directory Structure

The services expect:

```
/opt/pusula/current/           # Symlink to active release
├── apps/backend/dist/         # Compiled backend
└── apps/ui/dist/              # Built UI

/etc/pusula/
├── config.yaml               # Application config
├── credentials.json          # Password hash
├── upstream.json             # Upstream configuration
└── pusula.env                # Environment variables

/var/log/pusula/              # Logs
/var/lib/pusula/backups/      # Configuration backups
```

## Security Notes

- Services run as `pusula` user with nologin shell
- `ProtectSystem=strict` restricts filesystem writes
- Explicit `ReadWritePaths` for allowed directories
- `NoNewPrivileges=true` prevents privilege escalation
