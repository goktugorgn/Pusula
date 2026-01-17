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

| Aspect           | Details                     |
| ---------------- | --------------------------- |
| Username         | `goktugorgn` (configurable) |
| Password storage | Argon2id hash               |
| Session          | JWT with httpOnly cookie    |
| Token expiry     | 24 hours (configurable)     |

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

### File Operations

| Operation | Restriction                                     |
| --------- | ----------------------------------------------- |
| Read      | Limited to `/etc/unbound/`, `/var/log/unbound/` |
| Write     | Limited to `/etc/unbound/unbound.conf.d/`       |
| Backup    | Limited to `/opt/pusula/snapshots/`             |

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
    "user": "goktugorgn"
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
/opt/pusula/logs/audit.log
```

Rotation: Daily, 30 days retention.

---

## Transport Security

### HTTPS

| Aspect      | Details                                             |
| ----------- | --------------------------------------------------- |
| Required    | Yes (HTTP redirects to HTTPS)                       |
| Certificate | Self-signed (generated on install) or user-provided |
| TLS version | 1.2+ only                                           |

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
| User password hash | `/opt/pusula/config/pusula.yaml`    |
| JWT signing key    | Environment variable or config file |
| Pi-hole API token  | Config file (optional)              |

> [!WARNING]
> Protect `/opt/pusula/config/` with appropriate file permissions (600 or 640).

---

## Related Documents

- [ADR-0002: Auth Model](../adr/0002-auth-model.md)
- [06-operations.md](06-operations.md) – Operational security
- [09-runbook.md](09-runbook.md) – Security incident response
