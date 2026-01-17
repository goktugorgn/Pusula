# Architecture

## System Overview

Pusula follows a layered architecture with clear separation between UI, backend, and managed services.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (LAN)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (UI)                          │
│              Glassmorphism – Minimal Ops Design                 │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Node.js Backend (Agent)                         │
│          Fastify/Express │ Auth │ API │ Audit Log               │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
    │   Unbound    │    │  DoH Proxy   │    │   Pi-hole    │
    │   (DNS)      │    │ (cloudflared)│    │  (read-only) │
    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Components

### Frontend (React)

| Aspect    | Details                              |
| --------- | ------------------------------------ |
| Framework | React 18+                            |
| Styling   | Tailwind CSS (Glassmorphism theme)   |
| State     | React Query or SWR for data fetching |
| Build     | Vite                                 |
| Hosting   | Served by backend (static files)     |

**Responsibilities:**

- Render dashboard, settings, logs UI
- Handle user authentication flow
- Display real-time metrics (polling/WebSocket)
- Provide configuration editing UI

---

### Backend (Node.js Agent)

| Aspect    | Details                        |
| --------- | ------------------------------ |
| Runtime   | Node.js 18+ LTS                |
| Framework | Fastify (preferred) or Express |
| API       | RESTful JSON                   |
| Auth      | JWT with httpOnly cookies      |
| Security  | Rate limiting, audit logging   |

**Responsibilities:**

- Serve frontend static files
- Authenticate and authorize requests
- Execute allowlisted system commands
- Manage configuration files
- Aggregate metrics from services
- Trigger alerts

---

### Unbound DNS

| Aspect  | Details                                |
| ------- | -------------------------------------- |
| Service | systemd unit (`unbound.service`)       |
| Control | `unbound-control` (enabled)            |
| Config  | `/etc/unbound/unbound.conf` + includes |

**Managed Operations:**

- `unbound-control status`
- `unbound-control stats_noreset`
- `unbound-control reload`
- `unbound-control flush_zone`
- `unbound-checkconf`

---

### DoH Proxy

| Aspect  | Details                        |
| ------- | ------------------------------ |
| Service | cloudflared or dnscrypt-proxy  |
| Purpose | Forward DNS queries over HTTPS |
| Binding | localhost:5053 (example)       |

> [!IMPORTANT]
> Unbound forwards to DoH proxy on localhost when DoH mode is active.

---

### Pi-hole Integration

| Aspect   | Details                         |
| -------- | ------------------------------- |
| Access   | API read-only                   |
| Endpoint | `/admin/api.php`                |
| Data     | Summary statistics, top queries |

---

## Data Flow

### Query Resolution (DoH Mode)

```
Client → Pi-hole (blocker) → Unbound → DoH Proxy → Upstream
                                ↑
                        localhost:5053
```

### Configuration Change

```
UI → Backend → [Snapshot] → [Validate] → [Apply] → [Self-Test]
                                                        │
                              ┌─────────────────────────┘
                              ▼
                    [Success] OR [Rollback]
```

---

## File Structure

```
/opt/pusula/
├── backend/              # Node.js application
│   ├── src/
│   ├── package.json
│   └── .env
├── frontend/             # React build output
│   └── dist/
├── config/
│   └── pusula.yaml       # Application config
├── snapshots/            # Configuration backups
└── logs/
    └── audit.log
```

### Unbound Configuration

```
/etc/unbound/
├── unbound.conf          # Main config (includes below)
├── unbound.conf.d/
│   ├── 00-server.conf    # Base server settings
│   ├── 10-forward.conf   # Forward mode config (managed)
│   └── 20-local.conf     # Local overrides
```

> [!NOTE]
> Pusula manages files in `unbound.conf.d/`. The main `unbound.conf` includes this directory.

---

## Deployment Model

```
         Raspberry Pi OS
┌────────────────────────────────────┐
│                                    │
│  ┌────────────┐  ┌──────────────┐  │
│  │  pusula    │  │   unbound    │  │
│  │  backend   │  │   service    │  │
│  │  (systemd) │  │   (systemd)  │  │
│  └────────────┘  └──────────────┘  │
│                                    │
│  ┌────────────┐  ┌──────────────┐  │
│  │ cloudflared│  │   pihole-FTL │  │
│  │  (systemd) │  │   (systemd)  │  │
│  └────────────┘  └──────────────┘  │
│                                    │
└────────────────────────────────────┘
```

---

## Related Documents

- [00-context.md](00-context.md) – Project context
- [03-decisions.md](03-decisions.md) – Architecture decisions
- [Diagram: System Context](../diagrams/system-context.md)
