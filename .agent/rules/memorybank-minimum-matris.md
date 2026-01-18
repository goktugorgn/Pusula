---
trigger: always_on
---

MEMORYBANK UPDATE MATRIX (use this every task):
• If you add/change endpoints, params, auth behavior:
• Update docs/memorybank/04-api-contract.md
• Update docs/api/openapi.yaml
• If you change architecture, service boundaries, file paths:
• Update docs/memorybank/02-architecture.md
• If you change security (JWT, lockout, sudoers, permissions):
• Update docs/memorybank/05-security.md
• If it’s a new decision, add ADR + link in 03-decisions.md
• If you change install/service management/log locations:
• Update docs/memorybank/06-operations.md
• Update docs/memorybank/09-runbook.md for troubleshooting
• If you add self-test/alerts/monitoring behaviors:
• Update docs/memorybank/01-requirements.md (if scope changed)
• Update docs/memorybank/07-testing.md (tests/validation)
• Always add an entry to:
• docs/memorybank/10-changelog.md
