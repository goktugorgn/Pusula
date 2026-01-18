# Changelog

All notable changes to Pusula will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- **Backend API** (Node.js + Fastify + TypeScript)
- **Authentication**: bcrypt password hashing, JWT sessions, secure cookies
- **Rate Limiting**: 5/min login, 60/min API
- **Brute-Force Protection**: IP-based lockout (15min/1hr escalation)
- **Audit Logging**: JSON-lines to `/var/log/unbound-ui/audit.log`
- **Secure Command Execution**: `safeExec` with strict allowlist
- **Unbound Control Endpoints**: status, stats, logs, reload, restart, flush
- **Upstream Configuration**: GET/PUT with DoT/DoH/recursive modes
- **Config Renderer**: Generates `/etc/unbound/unbound-ui-managed.conf`
- **Apply Workflow**: snapshot → validate → apply → reload → self-test → rollback
- **Atomic File Writes**: temp + fsync + rename pattern
- **Self-Test Endpoint**: 4-stage diagnostics with pass/warn/fail status
- **Alerting System**: In-memory + JSON persistence, engine with thresholds
- **Pi-hole Integration**: Read-only summary with graceful fallback
- **137+ Unit Tests**: Comprehensive coverage across all modules

- **Systemd Unit Files**: Production-ready service definitions
  - `unbound-ui-backend.service` with security hardening
  - `unbound-ui-doh-proxy.service` (optional, disabled by default)
- **Sudoers Drop-in**: Least-privilege `system/sudoers-unbound-ui` for unbound-control, systemctl, journalctl
- **Installer Script**: `scripts/install.sh` for one-command Raspberry Pi OS installation
- **Health Check**: `scripts/postinstall-healthcheck.sh` for installation verification
- **Config Templates**: `system/config.yaml.example`, `system/credentials.json.example`

- **Frontend UI** (React + Vite + TanStack Query)
- **Login Page**: Fixed username, password input, lockout/rate-limit countdown
- **Dashboard**: Live status/stats polling (3s), mini charts, quick actions
- **Upstreams Page**: Mode selector, provider presets, priority ordering, change diff
- **Self-Test Page**: Stepper UI, pass/warn/fail status, copy diagnostics
- **Alerts Page**: Filter by status, acknowledge, nav badge with count
- **Logs Page**: LogViewer with level/time filters, follow mode, search, copy
- **Settings Page**: Change password form, server info, audit log placeholder
- **Design System**: GlassCard, StatCard, Button, Input, Badge, Toast, ConfirmModal
- **Auth System**: AuthContext, useAuth hook, ProtectedRoute, token storage

### Changed

- Migrated password hashing from Argon2id to bcrypt for broader compatibility
- Optimized animations for Pi (reduced-motion support, lighter transforms)
- Custom scrollbar styling for dark theme

### Security

- All endpoints require JWT authentication (except health/login)
- Command injection prevention via allowlisted commands only
- Parameter validation with regex patterns

---

## [0.1.0] - TBD

### Added

- User authentication with JWT
- Rate limiting and brute-force protection
- Dashboard with Unbound status
- Resolver mode switching (Recursive/DoT/DoH)
- Upstream provider management
- Safe apply workflow with snapshots
- Self-test engine
- Audit logging
- Basic alerting
- Pi-hole read-only integration
- One-command installer

---

## Version History Template

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- New features

### Changed

- Changes to existing functionality

### Deprecated

- Features that will be removed

### Removed

- Removed features

### Fixed

- Bug fixes

### Security

- Security-related changes
```

---

## Related Documents

- [08-roadmap.md](08-roadmap.md) – Future plans
- [01-requirements.md](01-requirements.md) – Feature requirements
