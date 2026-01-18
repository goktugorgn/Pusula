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

### Changed

- Migrated password hashing from Argon2id to bcrypt for broader compatibility

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
