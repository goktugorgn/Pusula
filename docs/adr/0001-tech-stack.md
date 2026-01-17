# ADR-0001: Technology Stack

## Status

**Accepted** – January 2026

---

## Context

Pusula needs a technology stack suitable for:

- Running on Raspberry Pi (limited resources)
- Single developer maintenance
- Modern, responsive UI
- Secure backend operations
- Direct integration with Unbound DNS

---

## Decision

### Frontend

| Choice        | Technology                             |
| ------------- | -------------------------------------- |
| Framework     | **React 18+**                          |
| Styling       | **Tailwind CSS** (Glassmorphism theme) |
| Build         | **Vite**                               |
| Data fetching | React Query or SWR                     |

**Rationale:**

- React provides component-based architecture, wide ecosystem
- Tailwind enables rapid UI development with consistent design
- Vite offers fast builds suitable for development on Pi

### Backend

| Choice    | Technology                        |
| --------- | --------------------------------- |
| Runtime   | **Node.js 18+ LTS**               |
| Framework | **Fastify** (Express as fallback) |
| Auth      | JWT with httpOnly cookies         |

**Rationale:**

- Node.js is lightweight, single-threaded, suitable for Pi
- Fastify is performant with schema validation built-in
- JavaScript/TypeScript across stack simplifies maintenance

### DNS Control

| Choice        | Technology          |
| ------------- | ------------------- |
| Resolver      | **Unbound**         |
| Control       | **unbound-control** |
| Config format | Native Unbound conf |

**Rationale:**

- Unbound is proven, lightweight, supports DoT natively
- `unbound-control` provides safe, socket-based management
- Avoids direct config file manipulation complexity

---

## Consequences

### Positive

- Unified JavaScript stack reduces context switching
- React + Tailwind enables polished UI quickly
- Fastify's performance is suitable for Pi resources
- `unbound-control` is safer than exec-based config changes

### Negative

- Requires Node.js installation on Pi (not pre-installed)
- Tailwind has learning curve for CSS purists
- Fastify is less common than Express (smaller community)

### Mitigations

- Installer script handles Node.js setup
- Tailwind documentation and examples are comprehensive
- Fastify/Express are interchangeable if needed

---

## Related

- [00-context.md](../memorybank/00-context.md) – Project context
- [02-architecture.md](../memorybank/02-architecture.md) – System architecture
