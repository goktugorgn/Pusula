# Self-Test Sequence Diagram

## Overview

This diagram illustrates the self-test workflow triggered after configuration changes or on-demand.

---

## Sequence Diagram

```mermaid
sequenceDiagram
    participant UI as React UI
    participant API as Backend API
    participant Validator as Config Validator
    participant Upstream as Upstream Tester
    participant Resolver as Resolver Tester
    participant Observer as Health Observer
    participant Unbound as Unbound

    UI->>+API: POST /self-test

    Note over API: Step 1: Configuration Validation
    API->>+Validator: validateConfig()
    Validator->>Unbound: unbound-checkconf
    Unbound-->>Validator: Exit code 0
    Validator-->>-API: ✓ Valid

    Note over API: Step 2: Upstream Connectivity
    API->>+Upstream: testUpstreams()

    alt DoT Mode
        Upstream->>Upstream: TLS handshake to upstream:853
        Upstream->>Upstream: DNS query test
    else DoH Mode
        Upstream->>Upstream: HTTPS to DoH proxy
        Upstream->>Upstream: DNS query via proxy
    else Recursive Mode
        Upstream->>Upstream: Root hint reachability
    end

    Upstream-->>-API: ✓ Upstreams reachable

    Note over API: Step 3: Resolver Functionality
    API->>+Resolver: testResolver()
    Resolver->>Unbound: dig example.com @127.0.0.1
    Unbound-->>Resolver: A record response
    Resolver->>Unbound: dig dnssec-failed.org @127.0.0.1
    Unbound-->>Resolver: SERVFAIL (expected)
    Resolver-->>-API: ✓ Resolver working

    Note over API: Step 4: Health Observation
    API->>+Observer: observeHealth(30s)

    loop Every 5 seconds for 30s
        Observer->>Unbound: unbound-control stats_noreset
        Unbound-->>Observer: Stats response
        Observer->>Observer: Check thresholds
    end

    Observer-->>-API: ✓ Health stable

    API-->>-UI: SelfTestResult { passed: true, steps: [...] }
```

---

## Step Details

### Step 1: Configuration Validation

```mermaid
flowchart TD
    A[Start] --> B{Run unbound-checkconf}
    B -->|Exit 0| C[✓ Pass]
    B -->|Exit ≠ 0| D[✗ Fail]
    C --> E[Return result]
    D --> E
```

**Checks:**

- Unbound configuration syntax
- Include file validity
- Forward zone configuration

---

### Step 2: Upstream Connectivity

```mermaid
flowchart TD
    A[Start] --> B{Get current mode}
    B -->|DoT| C[TLS handshake test]
    B -->|DoH| D[HTTPS + DNS test]
    B -->|Recursive| E[Root hint test]

    C --> F{Success?}
    D --> F
    E --> F

    F -->|Yes| G[✓ Pass]
    F -->|No| H[✗ Fail]
```

**Tests by Mode:**

| Mode      | Test                                             |
| --------- | ------------------------------------------------ |
| DoT       | TLS connection to `upstream:853`, send DNS query |
| DoH       | HTTPS request to proxy, DNS response validation  |
| Recursive | UDP query to root hints                          |

---

### Step 3: Resolver Functionality

```mermaid
flowchart TD
    A[Start] --> B[Query: example.com A]
    B --> C{Got A record?}
    C -->|No| X[✗ Fail]
    C -->|Yes| D[Query: dnssec-failed.org A]
    D --> E{Got SERVFAIL?}
    E -->|No| X
    E -->|Yes| F[Repeat query for cache test]
    F --> G{Response time < 10ms?}
    G -->|No| H[⚠ Warning]
    G -->|Yes| I[✓ Pass]
    H --> I
```

---

### Step 4: Health Observation

```mermaid
flowchart TD
    A[Start 30s window] --> B[Collect stats]
    B --> C{Success rate > 95%?}
    C -->|No| X[✗ Fail]
    C -->|Yes| D{Latency < 1000ms?}
    D -->|No| X
    D -->|Yes| E{Error rate < 5%?}
    E -->|No| X
    E -->|Yes| F{Time remaining?}
    F -->|Yes| B
    F -->|No| G[✓ Pass]
```

---

## Response Format

```json
{
  "success": true,
  "data": {
    "passed": true,
    "steps": [
      {
        "name": "config_validation",
        "passed": true,
        "duration": 150
      },
      {
        "name": "upstream_connectivity",
        "passed": true,
        "duration": 820
      },
      {
        "name": "resolver_functionality",
        "passed": true,
        "duration": 340
      },
      {
        "name": "health_observation",
        "passed": true,
        "duration": 30000
      }
    ],
    "totalDuration": 31310
  }
}
```

---

## Failure Handling

```mermaid
flowchart TD
    A[Self-Test Triggered] --> B[Run Steps 1-4]
    B --> C{All Passed?}
    C -->|Yes| D[Return Success]
    C -->|No| E{During Config Apply?}
    E -->|Yes| F[Trigger Rollback]
    E -->|No| G[Return Failure Report]
    F --> H[Restore Snapshot]
    H --> I[Reload Unbound]
    I --> G
```

---

## Related Documents

- [07-testing.md](../memorybank/07-testing.md) – Testing strategy
- [01-requirements.md](../memorybank/01-requirements.md) – Self-test requirements
- [09-runbook.md](../memorybank/09-runbook.md) – Troubleshooting
