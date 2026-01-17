# ADR-0003: Configuration Management

## Status

**Accepted** – January 2026

---

## Context

Pusula manages Unbound DNS configuration. Challenges include:

- Avoiding corruption of main Unbound config
- Enabling rollback on failure
- Validating changes before applying
- Maintaining audit trail of changes

---

## Decision

### Managed Include Files

| Aspect        | Choice                                   |
| ------------- | ---------------------------------------- |
| Strategy      | Include directory approach               |
| Managed path  | `/etc/unbound/unbound.conf.d/`           |
| Managed files | `10-forward.conf` (resolver mode config) |
| Untouched     | Main `unbound.conf`                      |

**Rationale:**

- Include directory isolates Pusula changes
- Main config remains pristine
- Multiple tools can coexist (Pi-hole, manual edits)

### Unbound Main Config Setup

```conf
# /etc/unbound/unbound.conf
server:
    # base settings...

include: /etc/unbound/unbound.conf.d/*.conf
```

### Snapshot Strategy

| Aspect    | Choice                                |
| --------- | ------------------------------------- |
| Trigger   | Before every config change            |
| Location  | `/opt/pusula/snapshots/`              |
| Naming    | `YYYY-MM-DDTHH-MM-SS_<filename>.conf` |
| Retention | 10 most recent                        |

**Rationale:**

- Every change is reversible
- Timestamped names enable chronological ordering
- Limited retention prevents disk exhaustion

### Apply Workflow

```
1. Snapshot current config
2. Write new config to temp file
3. Validate with unbound-checkconf
4. Move temp to target location
5. Reload via unbound-control reload
6. Run self-test
7. If self-test fails → restore snapshot → reload
```

**Rationale:**

- Atomic moves prevent partial writes
- Validation before apply catches syntax errors
- Self-test catches runtime issues
- Automatic rollback minimizes downtime

---

## Consequences

### Positive

- Safe changes with automatic rollback
- No risk to main Unbound configuration
- Full audit trail of config changes
- Easy manual recovery using snapshots

### Negative

- Additional complexity in apply workflow
- Disk space used by snapshots
- Requires include directive in main config

### Mitigations

- Snapshot cleanup maintains disk usage
- Installer sets up include directive
- Self-test validates changes quickly

---

## Alternatives Considered

| Alternative                | Reason Rejected                 |
| -------------------------- | ------------------------------- |
| Direct config editing      | High risk of corruption         |
| Full config generation     | Complex, hard to maintain       |
| unbound-control set_option | Limited scope, not all settings |

---

## Related

- [01-requirements.md](../memorybank/01-requirements.md) – Safe apply requirement
- [06-operations.md](../memorybank/06-operations.md) – Rollback procedure
- [07-testing.md](../memorybank/07-testing.md) – Self-test engine
