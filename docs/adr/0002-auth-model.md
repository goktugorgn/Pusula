# ADR-0002: Authentication Model

## Status

**Accepted** – January 2026

---

## Context

Pusula requires authentication to protect DNS configuration. Key considerations:

- Homelab environment (single administrator)
- LAN-only access (no internet exposure)
- Protection against brute-force attacks
- Audit trail for accountability

---

## Decision

### Single-User Model

| Aspect             | Choice                     |
| ------------------ | -------------------------- |
| User count         | Single user (`goktugorgn`) |
| Credential storage | Local configuration file   |
| Multi-user support | Not implemented            |

**Rationale:**

- Homelab typically has one administrator
- Multi-user adds complexity without benefit
- Simpler security model to audit

### Password Security

| Aspect           | Choice                    |
| ---------------- | ------------------------- |
| Hashing          | **Argon2id**              |
| Minimum length   | 12 characters             |
| Complexity rules | None (length prioritized) |

**Rationale:**

- Argon2id is current best practice (memory-hard)
- Length > complexity for password security
- Simple rules encourage stronger passwords

### Session Management

| Aspect     | Choice                  |
| ---------- | ----------------------- |
| Token type | JWT                     |
| Storage    | httpOnly cookie         |
| Expiry     | 24 hours (configurable) |

### Brute-Force Protection

| Aspect           | Choice                   |
| ---------------- | ------------------------ |
| Rate limit       | 5 attempts / minute / IP |
| Lockout trigger  | 5 consecutive failures   |
| Lockout duration | 15 minutes (escalating)  |

**Rationale:**

- IP-based lockout prevents attacker-induced denial of service
- Rate limiting slows automated attacks
- Escalating lockout handles persistent attackers

---

## Consequences

### Positive

- Simple model is easy to understand and audit
- Argon2id provides strong password protection
- IP-based lockout doesn't lock out legitimate user
- httpOnly cookies prevent XSS token theft

### Negative

- No multi-user support for shared homelabs
- Single point of failure (one password)
- IP-based lockout bypassable with IP rotation

### Mitigations

- Password reset procedure documented in runbook
- LAN-only access reduces attack surface
- Audit logging provides visibility into attempts

---

## Alternatives Considered

| Alternative      | Reason Rejected                  |
| ---------------- | -------------------------------- |
| OAuth2 / SSO     | Overkill for single-user homelab |
| Certificate auth | Too complex for target users     |
| API keys         | Less secure than password + JWT  |

---

## Related

- [05-security.md](../memorybank/05-security.md) – Full security model
- [09-runbook.md](../memorybank/09-runbook.md) – Password reset procedure
