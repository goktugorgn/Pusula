# ADR-0004: DoH via Proxy Service

## Status

**Accepted** – January 2026

---

## Context

Pusula supports DNS-over-HTTPS (DoH) for encrypted upstream resolution. Two approaches exist:

1. **Native forwarding**: Unbound directly forwards to DoH (requires external plugins)
2. **Proxy service**: Unbound forwards to local proxy that speaks DoH

---

## Decision

### Use Proxy Service for DoH

| Aspect              | Choice                        |
| ------------------- | ----------------------------- |
| DoH handling        | External proxy service        |
| Recommended proxies | cloudflared, dnscrypt-proxy   |
| Binding             | localhost:5053 (configurable) |
| Unbound config      | Forward to 127.0.0.1@5053     |

**Rationale:**

- Unbound lacks native DoH support
- Proxy approach is proven and stable
- cloudflared is actively maintained by Cloudflare
- Clear separation of concerns

### Architecture

```
┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│   Unbound    │───►│  DoH Proxy    │───►│  Upstream   │
│  127.0.0.1   │    │  (localhost:  │    │ DoH Server  │
│   :53        │    │    5053)      │    │  (HTTPS)    │
└──────────────┘    └───────────────┘    └─────────────┘
```

### Unbound Forward Configuration

```conf
# /etc/unbound/unbound.conf.d/10-forward.conf
forward-zone:
    name: "."
    forward-addr: 127.0.0.1@5053
```

### Supported DoH Proxies

| Proxy              | Notes                                                |
| ------------------ | ---------------------------------------------------- |
| **cloudflared**    | Easy setup, designed for Cloudflare but configurable |
| **dnscrypt-proxy** | More flexible, supports multiple protocols           |

---

## Consequences

### Positive

- Proven stability with widely-used proxies
- Unbound config remains simple
- Proxy handles TLS/HTTPS complexity
- Easy to switch providers by reconfiguring proxy
- Independent failure domains (can troubleshoot separately)

### Negative

- Additional service to manage (systemd unit)
- Additional network hop (localhost, minimal latency)
- Dependency on external project maintenance

### Mitigations

- Installer sets up proxy service
- Self-test validates proxy connectivity
- Proxy has built-in health checks
- Both recommended proxies are stable, active projects

---

## Alternatives Considered

| Alternative           | Reason Rejected                        |
| --------------------- | -------------------------------------- |
| Unbound DNS-over-QUIC | Experimental, limited upstream support |
| Direct HTTPS queries  | Would require custom implementation    |
| Native Unbound DoH    | Not available without patches          |

---

## Configuration Examples

### cloudflared

```yaml
# /etc/cloudflared/config.yml
proxy-dns: true
proxy-dns-port: 5053
proxy-dns-upstream:
  - https://1.1.1.1/dns-query
  - https://1.0.0.1/dns-query
```

### dnscrypt-proxy

```toml
# /etc/dnscrypt-proxy/dnscrypt-proxy.toml
listen_addresses = ['127.0.0.1:5053']
server_names = ['cloudflare', 'cloudflare-ipv6']
```

---

## Related

- [01-requirements.md](../memorybank/01-requirements.md) – DoH requirement
- [02-architecture.md](../memorybank/02-architecture.md) – System architecture
- [06-operations.md](../memorybank/06-operations.md) – Service management
