# Pusula Documentation

> **Pusula** – LAN-only web management interface for Unbound DNS on Raspberry Pi

---

## Quick Links

| Document                                         | Description                                |
| ------------------------------------------------ | ------------------------------------------ |
| [00-context](memorybank/00-context.md)           | Project overview and scope                 |
| [01-requirements](memorybank/01-requirements.md) | Functional and non-functional requirements |
| [02-architecture](memorybank/02-architecture.md) | System architecture                        |
| [OpenAPI Spec](api/openapi.yaml)                 | REST API specification                     |

---

## Documentation Structure

```
docs/
├── README.md                    ← You are here
├── memorybank/                  ← Single Source of Truth
│   ├── 00-context.md            Project context
│   ├── 01-requirements.md       Requirements
│   ├── 02-architecture.md       Architecture
│   ├── 03-decisions.md          Decision index → ADRs
│   ├── 04-api-contract.md       API overview → OpenAPI
│   ├── 05-security.md           Security model
│   ├── 06-operations.md         Operations guide
│   ├── 07-testing.md            Testing strategy
│   ├── 08-roadmap.md            Development roadmap
│   ├── 09-runbook.md            Operational runbook
│   └── 10-changelog.md          Version changelog
├── adr/                         ← Architecture Decisions
│   ├── 0001-tech-stack.md
│   ├── 0002-auth-model.md
│   ├── 0003-config-management.md
│   └── 0004-doh-proxy.md
├── api/                         ← API Documentation
│   └── openapi.yaml
└── diagrams/                    ← Visual Diagrams
    ├── system-context.md
    └── sequence-self-test.md
```

---

## Memorybank Concept

The `memorybank/` directory is the **Single Source of Truth (SSOT)** for this project:

- All other documentation must align with memorybank
- Design decisions link to ADRs
- API details link to OpenAPI spec
- Diagrams provide visual references

---

## Getting Started

1. **Understand the project** → [00-context.md](memorybank/00-context.md)
2. **Review requirements** → [01-requirements.md](memorybank/01-requirements.md)
3. **Study architecture** → [02-architecture.md](memorybank/02-architecture.md)
4. **Installation guide** → [06-operations.md](memorybank/06-operations.md)

---

## For Developers

| Topic          | Document                                      |
| -------------- | --------------------------------------------- |
| API Reference  | [openapi.yaml](api/openapi.yaml)              |
| Security Model | [05-security.md](memorybank/05-security.md)   |
| Testing        | [07-testing.md](memorybank/07-testing.md)     |
| ADRs           | [03-decisions.md](memorybank/03-decisions.md) |

---

## For Operators

| Topic           | Document                                                  |
| --------------- | --------------------------------------------------------- |
| Installation    | [06-operations.md](memorybank/06-operations.md)           |
| Runbook         | [09-runbook.md](memorybank/09-runbook.md)                 |
| Troubleshooting | [09-runbook.md](memorybank/09-runbook.md#troubleshooting) |

---

## License

MIT License – See [LICENSE](../LICENSE) for details.
