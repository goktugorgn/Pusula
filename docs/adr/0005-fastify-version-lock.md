# ADR-0005: Fastify Plugin Version Compatibility

## Status

Accepted

## Date

2026-01-19

## Context

The Pusula backend uses Fastify as its web framework with several official plugins including `@fastify/jwt` for JWT authentication. Fastify 5.x introduced breaking changes in the plugin interface, and plugins like `@fastify/jwt` have major version splits:

- `@fastify/jwt@8.x` requires Fastify 5.x
- `@fastify/jwt@7.x` requires Fastify 4.x

Using incompatible versions results in `FST_ERR_PLUGIN_VERSION_MISMATCH` at runtime.

## Decision

**Lock to Fastify 4.x with compatible plugin versions:**

| Package               | Version   | Rationale                                    |
| --------------------- | --------- | -------------------------------------------- |
| `fastify`             | `^4.26.0` | Stable, well-tested, broad ecosystem support |
| `@fastify/jwt`        | `^7.2.4`  | Compatible with Fastify 4.x                  |
| `@fastify/cookie`     | `^9.3.1`  | Compatible with Fastify 4.x                  |
| `@fastify/cors`       | `^9.0.1`  | Compatible with Fastify 4.x                  |
| `@fastify/helmet`     | `^11.1.1` | Compatible with Fastify 4.x                  |
| `@fastify/rate-limit` | `^9.1.0`  | Compatible with Fastify 4.x                  |
| `@fastify/static`     | `^7.0.1`  | Compatible with Fastify 4.x                  |

**Added `npm run doctor` script** to verify version compatibility at build time.

## Consequences

### Positive

- No runtime plugin version mismatch errors
- Stable Fastify 4.x API
- CI can run `npm run doctor` to catch mismatches early
- Clear upgrade path: when upgrading to Fastify 5, update all plugins together

### Negative

- Cannot use Fastify 5.x features until coordinated upgrade
- Must check plugin compatibility when updating any Fastify plugin

## Alternatives Considered

1. **Upgrade to Fastify 5.x**: Rejected - would require updating all plugins and testing for breaking changes
2. **Pin exact versions**: Rejected - too restrictive, prevents minor/patch updates
3. **No enforcement**: Rejected - led to the original problem

## Related

- [ADR-0001: Technology Stack](0001-tech-stack.md)
