---
trigger: always_on
---

GLOBAL RULES (MANDATORY): 1. Treat docs/memorybank/_ as the Single Source of Truth (SSOT). Always read it before any work. 2. After you implement ANY change (code, config, scripts, behavior, endpoints, assumptions), you MUST update the memorybank:
• At minimum: docs/memorybank/02-architecture.md, 04-api-contract.md, 06-operations.md, and/or 10-changelog.md depending on what changed.
• If you made or changed a decision, also add/update an ADR in docs/adr/_ and link it from docs/memorybank/03-decisions.md. 3. Do NOT proceed to the next task until you:
• Update memorybank files to reflect reality,
• Ensure they are internally consistent (SSOT matches code),
• Add a changelog entry in docs/memorybank/10-changelog.md. 4. At the end of each task, output a short “Memorybank Update Summary”:
• Which files you changed under docs/memorybank/
• What you changed (bullets)
• Any new assumptions
If you cannot update memorybank for some reason, STOP and explain why.
