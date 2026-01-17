# Project Context

## Overview

**Pusula** is a LAN-only web management interface for Unbound DNS, designed to run directly on Raspberry Pi OS without containerization.

The name "Pusula" (Turkish for "compass") reflects the project's purpose: guiding DNS resolution safely and transparently within a home network.

---

## Purpose

Provide a secure, intuitive web interface for managing Unbound DNS configuration on a Raspberry Pi, enabling:

- Visual DNS resolver mode selection (Recursive, DoT, DoH)
- Safe configuration changes with rollback capability
- Real-time monitoring and alerting
- Audit logging for all administrative actions

---

## Scope

### In Scope

| Area                     | Description                                     |
| ------------------------ | ----------------------------------------------- |
| **Resolver Management**  | Mode switching, upstream provider configuration |
| **Configuration Safety** | Snapshot, validate, apply, rollback workflow    |
| **Monitoring**           | Status, stats, logs, cache metrics              |
| **Alerting**             | Service health, upstream failures, anomalies    |
| **Authentication**       | Single-user login with rate limiting            |
| **Pi-hole Integration**  | Read-only metrics display                       |

### Out of Scope

- Multi-user authentication / RBAC
- Remote (WAN) access
- Docker/container deployment
- Direct Pi-hole configuration changes

---

## Technology Stack

| Layer                   | Technology                                 |
| ----------------------- | ------------------------------------------ |
| **Frontend**            | React + Tailwind CSS (Glassmorphism style) |
| **Backend**             | Node.js (Fastify or Express)               |
| **DNS Resolver**        | Unbound (systemd service)                  |
| **Control Interface**   | `unbound-control`                          |
| **DoH Proxy**           | cloudflared or dnscrypt-proxy              |
| **Display Integration** | Pi-hole (read-only)                        |

---

## Deployment Environment

| Attribute           | Value                                     |
| ------------------- | ----------------------------------------- |
| **Target Platform** | Raspberry Pi OS (64-bit recommended)      |
| **Network Access**  | LAN-only (configurable bind address/port) |
| **Service Manager** | systemd                                   |
| **Installation**    | One-command installer script              |

---

## Constraints

1. **No containerization** – runs directly on Pi OS
2. **LAN-only** – no exposed external endpoints
3. **Single user** – homelab-grade, not multi-tenant
4. **Allowlisted commands** – backend executes only predefined operations
5. **Non-destructive defaults** – all changes are reversible

---

## Related Documents

- [01-requirements.md](01-requirements.md) – Functional and non-functional requirements
- [02-architecture.md](02-architecture.md) – System architecture
- [ADR: 0001-tech-stack](../adr/0001-tech-stack.md) – Technology stack decision
