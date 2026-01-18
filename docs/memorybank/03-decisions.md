# Decisions

## Architecture Decision Records

This document indexes all Architecture Decision Records (ADRs) for the Pusula project.

---

## Decision Index

| ID                                           | Title                    | Status   | Date    |
| -------------------------------------------- | ------------------------ | -------- | ------- |
| [ADR-0001](../adr/0001-tech-stack.md)        | Technology Stack         | Accepted | 2026-01 |
| [ADR-0002](../adr/0002-auth-model.md)        | Authentication Model     | Accepted | 2026-01 |
| [ADR-0003](../adr/0003-config-management.md) | Configuration Management | Accepted | 2026-01 |
| [ADR-0004](../adr/0004-doh-proxy.md)         | DoH via Proxy Service    | Accepted | 2026-01 |

---

## Decision Summary

### Technology Stack (ADR-0001)

- **Frontend**: React + Tailwind CSS for modern, maintainable UI
- **Backend**: Node.js with Fastify for lightweight API layer
- **DNS Control**: `unbound-control` for safe, non-intrusive management

### Authentication Model (ADR-0002)

- Single-user model suitable for homelab
- Password hashing with bcrypt (12 rounds)
- Rate limiting and lockout for brute-force protection

### Configuration Management (ADR-0003)

- Managed include files in `/etc/unbound/unbound.conf.d/`
- Snapshot before every change
- Automatic rollback on validation or self-test failure

### DoH Proxy (ADR-0004)

- DoH forwarding via external proxy (cloudflared/dnscrypt-proxy)
- Unbound forwards to localhost proxy
- Keeps Unbound configuration simple and portable

---

## Pending Decisions

| Topic                       | Status       | Notes                         |
| --------------------------- | ------------ | ----------------------------- |
| WebSocket vs Polling        | Under Review | For real-time log streaming   |
| Alert notification channels | Planned      | Email, webhook, or local only |

---

## Related Documents

- [02-architecture.md](02-architecture.md) – System architecture
- [ADR Directory](../adr/) – Full ADR documents
