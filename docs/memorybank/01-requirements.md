# Requirements

## Functional Requirements

### FR-01: Resolver Mode Selection

Users can switch between three DNS resolution modes:

| Mode                | Description                           | Implementation    |
| ------------------- | ------------------------------------- | ----------------- |
| **Recursive**       | Direct resolution from root servers   | Native Unbound    |
| **Forward via DoT** | Encrypted forwarding (DNS-over-TLS)   | Native Unbound    |
| **Forward via DoH** | Encrypted forwarding (DNS-over-HTTPS) | Via proxy service |

---

### FR-02: Authentication

| Requirement        | Details                |
| ------------------ | ---------------------- |
| Single user        | Username: `goktugorgn` |
| Password change    | Available via UI       |
| Session management | JWT or secure cookie   |

---

### FR-03: Security Controls

| Control             | Behavior                           |
| ------------------- | ---------------------------------- |
| Rate limiting       | Limit login attempts per IP        |
| Brute-force lockout | Temporary lockout after N failures |
| Audit logging       | All state-changing actions logged  |

---

### FR-04: Upstream Provider Management

- Configure DoT upstream servers (IP, port, TLS hostname)
- Configure DoH upstream servers (URL)
- Enable/disable individual upstreams
- Test upstream connectivity before applying

---

### FR-05: Safe Apply Workflow

Configuration changes follow a safe workflow:

```
snapshot → validate → reload → self-test → [rollback on failure]
```

1. **Snapshot** – Save current working configuration
2. **Validate** – Syntax check via `unbound-checkconf`
3. **Reload** – Apply via `unbound-control reload`
4. **Self-test** – Verify functionality
5. **Rollback** – Restore snapshot on any failure

---

### FR-06: Self-Test Engine

Automated verification sequence:

| Step | Test                                                         |
| ---- | ------------------------------------------------------------ |
| 1    | Configuration validation                                     |
| 2    | Upstream connectivity (TLS handshake / HTTPS + DNS response) |
| 3    | Resolver functionality (query tests + DNSSEC sanity)         |
| 4    | Short health observation window                              |

---

### FR-07: Live Dashboard

Display real-time metrics:

- Unbound service status and uptime
- Query rate (queries/second)
- Cache hit ratio
- Error rates (SERVFAIL, NXDOMAIN trends)
- Live log viewer with filters

---

### FR-08: Alerting

Generate alerts for:

| Condition               | Severity |
| ----------------------- | -------- |
| Unbound service down    | Critical |
| Upstream unreachable    | Warning  |
| Error rate spike        | Warning  |
| Cache hit ratio anomaly | Info     |

Alerts can be acknowledged via UI.

---

### FR-09: Pi-hole Integration

Display-only integration:

- Query counts
- Blocked query counts
- Top domains / clients
- Status indicator

> [!NOTE]
> No Pi-hole configuration changes are made by Pusula.

---

### FR-10: Installation

- One-command installer script
- Systemd service files for backend and DoH proxy
- Initial configuration wizard

---

## Non-Functional Requirements

### NFR-01: Security

| Aspect            | Requirement                                  |
| ----------------- | -------------------------------------------- |
| Network binding   | LAN-only, configurable IP/port               |
| Password storage  | Argon2 or bcrypt hashing                     |
| Command execution | Allowlisted operations only                  |
| Transport         | HTTPS with self-signed or user-provided cert |

---

### NFR-02: Reliability

| Aspect               | Requirement                              |
| -------------------- | ---------------------------------------- |
| Rollback             | Configuration changes are reversible     |
| Graceful degradation | UI remains accessible if Unbound is down |
| Health checks        | Self-test validates functionality        |

---

### NFR-03: Performance

| Aspect              | Requirement                            |
| ------------------- | -------------------------------------- |
| Dashboard refresh   | ≤ 5 second latency                     |
| Configuration apply | ≤ 30 seconds including self-test       |
| Resource usage      | Suitable for Raspberry Pi 3B+ or newer |

---

### NFR-04: Usability

| Aspect        | Requirement                             |
| ------------- | --------------------------------------- |
| Visual style  | Glassmorphism – Minimal Ops             |
| Responsive    | Works on desktop and tablet             |
| Accessibility | Keyboard navigable, sufficient contrast |

---

### NFR-05: Maintainability

| Aspect        | Requirement          |
| ------------- | -------------------- |
| Documentation | Memorybank as SSOT   |
| Logging       | Structured JSON logs |
| Versioning    | Semantic versioning  |

---

## Related Documents

- [00-context.md](00-context.md) – Project context
- [02-architecture.md](02-architecture.md) – System architecture
- [05-security.md](05-security.md) – Security model
