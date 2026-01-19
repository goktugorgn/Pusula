# Security

## Security Model Overview

Pusula implements defense-in-depth with multiple security layers appropriate for a homelab environment.

---

## Network Security

### LAN-Only Operation

| Aspect   | Implementation                                   |
| -------- | ------------------------------------------------ |
| Binding  | Configurable IP address (default: LAN interface) |
| Port     | Configurable (default: 3000)                     |
| Firewall | Recommend blocking external access to port       |

> [!CAUTION]
> Pusula is designed for LAN-only access. Do NOT expose to the internet without additional security measures (VPN, reverse proxy with auth).

---

## Authentication

### Single-User Model

| Aspect           | Details                  |
| ---------------- | ------------------------ |
| Username         | `admin` (configurable)   |
| Password storage | bcrypt hash (12 rounds)  |
| Session          | JWT with httpOnly cookie |
| Token expiry     | 24 hours (configurable)  |

### Password Requirements

- Minimum 12 characters
- No complexity rules (length prioritized)
- Change via UI only (no CLI reset without manual intervention)

---

## Brute-Force Protection

### Rate Limiting

| Scope                 | Limit | Window   |
| --------------------- | ----- | -------- |
| Login attempts per IP | 5     | 1 minute |
| API calls per token   | 60    | 1 minute |

### Account Lockout

| Trigger          | Action            | Duration   |
| ---------------- | ----------------- | ---------- |
| 5 failed logins  | Temporary lockout | 15 minutes |
| 10 failed logins | Extended lockout  | 1 hour     |

Lockout is per-IP, not per-account (prevents user lockout by attacker).

---

## Command Execution Security

### Allowlisted Operations Only

The backend executes **only** predefined commands:

```javascript
const ALLOWED_COMMANDS = {
  "unbound-status": "unbound-control status",
  "unbound-stats": "unbound-control stats_noreset",
  "unbound-reload": "unbound-control reload",
  "unbound-flush": "unbound-control flush_zone .",
  "unbound-checkconf": "unbound-checkconf",
  "service-restart": "systemctl restart unbound",
};
```

> [!IMPORTANT]
> No user input is interpolated into commands. All operations use fixed command strings or controlled parameters.

### Sudoers Configuration (Least-Privilege)

The `pusula` service user has **minimal** sudo access via a drop-in file:

```bash
# /etc/sudoers.d/pusula
# Installed automatically by install.sh

# Unbound control commands
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control status
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control stats_noreset
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control reload
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control flush_zone *
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-control flush_requestlist
pusula ALL=(ALL) NOPASSWD: /usr/sbin/unbound-checkconf

# Systemctl (Unbound only)
pusula ALL=(ALL) NOPASSWD: /bin/systemctl is-active unbound
pusula ALL=(ALL) NOPASSWD: /bin/systemctl status unbound
pusula ALL=(ALL) NOPASSWD: /bin/systemctl reload unbound
pusula ALL=(ALL) NOPASSWD: /bin/systemctl restart unbound

# Journalctl (read-only)
pusula ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u unbound *
```

**Backend invocation:**

The `safeExec` module automatically prefixes privileged commands with `sudo -n` (non-interactive mode):

```typescript
// safeExec.ts execution logic
const actualCmd = def.sudo ? "sudo" : def.cmd;
const actualArgs = def.sudo ? ["-n", def.cmd, ...args] : args;
spawn(actualCmd, actualArgs, { shell: false });
```

> [!WARNING]
> Never grant broad sudo access. Each command is explicit and auditable.

### File Operations

| Operation | Restriction                                     |
| --------- | ----------------------------------------------- |
| Read      | Limited to `/etc/unbound/`, `/var/log/unbound/` |
| Write     | Limited to `/etc/unbound/pusula-managed.conf`   |
| Backup    | Limited to `/var/lib/pusula/backups/`           |

---

## Audit Logging

### Logged Events

All state-changing actions are logged:

| Event                | Data Captured                      |
| -------------------- | ---------------------------------- |
| Login success        | Timestamp, IP, user-agent          |
| Login failure        | Timestamp, IP, user-agent, reason  |
| Password change      | Timestamp, IP                      |
| Config apply         | Timestamp, IP, config diff summary |
| Config rollback      | Timestamp, IP, reason              |
| Resolver mode change | Timestamp, IP, old mode, new mode  |
| Upstream change      | Timestamp, IP, change summary      |
| Service reload       | Timestamp, IP                      |
| Service restart      | Timestamp, IP                      |
| Cache flush          | Timestamp, IP                      |

### Log Format

```json
{
  "timestamp": "2026-01-17T14:30:00Z",
  "level": "info",
  "event": "config_apply",
  "actor": {
    "ip": "192.168.1.100",
    "user": "admin"
  },
  "details": {
    "mode": "dot",
    "upstreams": ["1.1.1.1@853", "1.0.0.1@853"]
  },
  "result": "success"
}
```

### Log Location

```
/var/log/pusula/audit.log   # Production
./audit.log                     # Development
```

Rotation: Daily, 30 days retention.

---

## Transport Security

### HTTPS (Optional)

| Aspect      | Details                                             |
| ----------- | --------------------------------------------------- |
| Default     | HTTP (HTTPS optional via reverse proxy or config)   |
| Certificate | Self-signed or user-provided (if enabling HTTPS)    |
| Recommended | Use reverse proxy (nginx/Caddy) for TLS termination |

> [!TIP]
> For production deployments, place Pusula behind a reverse proxy with HTTPS enabled.

### Cookie Security

| Attribute | Value  |
| --------- | ------ |
| httpOnly  | true   |
| secure    | true   |
| sameSite  | strict |

---

## Configuration Security

### Snapshot Isolation

- Snapshots stored with read-only permissions
- Timestamped naming prevents overwrite
- Maximum 10 snapshots retained

### Validation Before Apply

1. `unbound-checkconf` must pass
2. Syntax validation on managed files
3. Self-test after reload

---

## Secrets Management

| Secret             | Storage                             |
| ------------------ | ----------------------------------- |
| User password hash | `/etc/pusula/credentials.json`      |
| JWT signing key    | `JWT_SECRET` env var or config file |
| Pi-hole API token  | Config file (optional)              |

> [!WARNING]
> Protect `/etc/pusula/` with appropriate file permissions (600 or 640).

---

## Related Documents

- [ADR-0002: Auth Model](../adr/0002-auth-model.md)
- [06-operations.md](06-operations.md) – Operational security
- [09-runbook.md](09-runbook.md) – Security incident response
