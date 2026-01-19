# Changelog

All notable changes to Pusula will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] - 2026-01-19

### Added

- **Production Packaging Overhaul**:
  - New directory layout: `/opt/pusula/current/` symlink with `/releases/` for versioning
  - New naming convention: `pusula` service user, `/etc/pusula/`, `/var/lib/pusula/`
  - New systemd units: `pusula.service`, `pusula-doh-proxy.service`
  - Added `systemd/README.md` documenting service units

- **CLI Management Tool (`pusula` command)**:
  - Commands: `start`, `stop`, `restart`, `status`, `autostart on|off`
  - New: `health` - Check API health endpoint
  - New: `version` - Show version and commit info
  - New: `logs [backend|unbound|proxy|audit]`

- **Developer Tools**:
  - Added `npm run doctor` - Validates Fastify plugin version compatibility
  - Added `scripts/postinstall-healthcheck.sh` for installation verification

- **ADR-0005**: Fastify Version Lock decision documented

### Changed

- **Installer (`scripts/install.sh`)**:
  - Complete rewrite for new layout
  - Release-based deployment with symlinks
  - Remote install via curl pipe
  - Idempotent upgrade support
  - New sudoers configuration for `pusula` user

- **Uninstaller (`scripts/uninstall.sh`)**:
  - Supports `--yes` flag to skip confirmation
  - Cleans up old `unbound-ui-*` naming
  - Preserves config/data by default, `--purge` for full removal

### Fixed

- **Fastify Plugin Version Mismatch**:
  - Locked `@fastify/jwt` to `^7.2.4` for Fastify 4 compatibility
  - Added `npm run doctor` to prevent future mismatches

- **Path Alignment**:
  - Fixed `server.ts` UI path (configurable via `UI_STATIC_PATH`)
  - Fixed systemd `WorkingDirectory` to new layout

- **Production Hardening (2026-01-19)**:
  - **Node.js**: Pin to v20 LTS (installer enforce, package.json engines) to prevent v23+ incompatibility
  - **Build**: Fixed production build flow (`npm ci` -> `npm run build` -> `npm prune`) to ensure `dist/` exists
  - **Systemd**: Fixed `NAMESPACE` error by creating managed config file
  - **Installer**: Fixed SIGPIPE crash in JWT generation
  - **Uninstall**: Added cleanup for managed config file

- **Node.js Auto-Fix (2026-01-19)**:
  - Installer now **automatically removes** Node.js v23+ and installs v20 LTS
  - Added `fix_nodejs_version()` function: stops Pusula, purges nodejs, cleans NodeSource repos
  - Added `install_nodejs_20()` function: fetches NodeSource setup_20.x script
  - Cleaner dependency handling with before/after version logging

- **Unbound Integration Fix (2026-01-19)**:
  - **New endpoint**: `GET /api/unbound/connection` - Returns connectivity status for UI health indicators
  - **Backend**: Added `checkConfigWithDetails()` returning stdout/stderr for config validation
  - **Backend**: Added `getUnboundConnection()` for connectivity monitoring with last success/error tracking
  - **Self-test**: `config_validation` now returns detailed error output with diagnostics
  - **Self-test**: `observation_window` now provides actionable error messages (permissions, certs, remote-control hints)
  - **UI**: Added `keepPreviousData` to all React Query hooks - prevents flicker during refetch
  - **UI**: Added connection status badge ("Connected" / "Degraded") to dashboard header
  - **Types**: Added `UnboundConnection` interface to frontend types

- **Critical Fixes (2026-01-19)**:
  - **Uninstall Purge**: Now removes CLI from all locations (`/usr/local/bin`, `/usr/bin`, `/bin`, `/usr/local/sbin`)
  - **Uninstall Purge**: Added `systemctl reset-failed` after unit removal
  - **Uninstall Purge**: Added temp file cleanup (`/tmp/pusula*`, `/var/tmp/pusula*`)
  - **Uninstall Purge**: Added sudoers validation after removal
  - **Uninstall Purge**: Added `scripts/uninstall-selfcheck.sh` verification script
  - **Backend**: All privileged commands now execute with `sudo -n` (non-interactive)
  - **Backend**: Fixed Unbound data not displaying - commands were missing sudo prefix
  - **Backend**: Fixed all hardcoded `unbound-ui` paths to use `pusula` paths for consistent naming
  - **Installer**: Added global TypeScript installation (`npm install -g typescript`) to support manual rebuilds on Raspberry Pi

---

## [1.0.0] - 2026-01-18

### Added

- **Local macOS DEV Mode (2026-01-18)**:
  - Added "Local macOS DEV mode" section to `06-operations.md`
  - Added "Local DEV Troubleshooting" section to `09-runbook.md`
  - Added `src/config/mockConfig.ts` for DEV mode path resolution
  - Added `src/utils/mockExec.ts` for mock command execution
  - Integrated mock layer into `safeExec.ts` via `UNBOUND_UI_ENV=dev` check
  - Created 7 mock data fixtures in `apps/backend/mock-data/`
  - Added `.env.dev` pre-configured DEV environment
  - Added `scripts/setup-local-dev.sh` to create `.local-dev/` structure
  - Added `scripts/local-smoke-test.sh` for endpoint verification
  - Updated `apps/ui/README.md` with local dev instructions
  - Added `apps/ui/.env.example`
  - Added `.local-dev/` to `.gitignore`

- **Documentation Sync (2026-01-18)**:
  - Added `/api/logout` endpoint to API contract and OpenAPI spec
  - Added comprehensive smoke test checklist to runbook
  - Added manual verification steps table to runbook

### Changed

- **Documentation Corrections**:
  - Fixed password hashing algorithm in ADR summary (Argon2 → bcrypt)
  - Fixed HTTPS section in security docs (optional, not enforced)
  - Corrected service names throughout docs (`pusula` → `unbound-ui-backend`)
  - Fixed file paths in runbook (`/opt/pusula/logs/` → `/var/log/unbound-ui/`)
  - Fixed snapshot paths in runbook (`/opt/pusula/snapshots/` → `/var/lib/unbound-ui/backups/`)

- **Default Credentials**:
  - Changed default username from `goktugorgn` to `admin` across all files
  - Changed default installer password to `admin` (was randomly generated)

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
- **Uninstall Script**: `scripts/uninstall.sh` with --purge option
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
