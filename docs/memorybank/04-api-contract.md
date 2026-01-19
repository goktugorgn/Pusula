# API Contract

## Overview

Pusula exposes a RESTful JSON API for all frontend-backend communication. All endpoints require authentication except `/api/login` and `/api/health`.

---

## OpenAPI Specification

The full API specification is available in OpenAPI 3.0 format:

📄 **[openapi.yaml](../api/openapi.yaml)**

---

## Base URL

```
https://<pi-ip>:<port>/api
```

Default: `https://192.168.1.x:3000/api`

---

## Authentication

| Method      | Details                          |
| ----------- | -------------------------------- |
| Type        | JWT Bearer Token                 |
| Header      | `Authorization: Bearer <token>`  |
| Alternative | httpOnly cookie (`pusula_token`) |
| Expiry      | Configurable (default: 24 hours) |

### Login Request

```json
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

### Login Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

### UI Token Persistence Policy

| Aspect | Policy |
| ------ | ------ |
| Storage | Always persist to `localStorage` |
| Rationale | LAN-only single-user homelab app; convenience prioritized |
| Key | `auth_token` |
| Rehydration | On app load, token is restored from `localStorage` |
| Expiry handling | On 401, token is cleared and user redirected to login |

> [!NOTE]
> The UI always persists tokens because Pusula is designed for LAN-only access with a single admin user. This prioritizes user experience (staying logged in across refreshes) over XSS concerns that apply to internet-facing apps.

---

## Endpoint Summary

### Authentication

| Method | Endpoint                | Description                    |
| ------ | ----------------------- | ------------------------------ |
| `POST` | `/login`                | Authenticate and receive token |
| `POST` | `/logout`               | Clear auth cookie              |
| `POST` | `/user/change-password` | Change current user password   |

### Health & Status

| Method | Endpoint              | Description                           |
| ------ | --------------------- | ------------------------------------- |
| `GET`  | `/health`             | Backend health check (public)         |
| `GET`  | `/unbound/status`     | Unbound service status                |
| `GET`  | `/unbound/stats`      | Resolver statistics                   |
| `GET`  | `/unbound/logs`       | Recent log entries                    |
| `GET`  | `/unbound/connection` | Connectivity status for UI indicators |

### Unbound Control

| Method | Endpoint           | Description          |
| ------ | ------------------ | -------------------- |
| `POST` | `/unbound/reload`  | Reload configuration |
| `POST` | `/unbound/restart` | Restart service      |
| `POST` | `/unbound/flush`   | Flush DNS cache      |

### Configuration

| Method | Endpoint          | Description                      |
| ------ | ----------------- | -------------------------------- |
| `GET`  | `/upstream`       | Get upstream configuration       |
| `PUT`  | `/upstream`       | Update upstream configuration    |
| `POST` | `/self-test`      | Run self-test sequence           |
| `GET`  | `/self-test/last` | Get result of last run self-test |

### Alerts

| Method | Endpoint      | Description          |
| ------ | ------------- | -------------------- |
| `GET`  | `/alerts`     | List active alerts   |
| `POST` | `/alerts/ack` | Acknowledge an alert |

### Pi-hole

| Method | Endpoint          | Description           |
| ------ | ----------------- | --------------------- |
| `GET`  | `/pihole/summary` | Pi-hole summary stats |

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid upstream URL format"
  }
}
```

---

## Error Codes

| Code               | HTTP Status | Description                 |
| ------------------ | ----------- | --------------------------- |
| `UNAUTHORIZED`     | 401         | Missing or invalid token    |
| `FORBIDDEN`        | 403         | Insufficient permissions    |
| `NOT_FOUND`        | 404         | Resource not found          |
| `VALIDATION_ERROR` | 400         | Invalid request data        |
| `RATE_LIMITED`     | 429         | Too many requests           |
| `LOCKED_OUT`       | 423         | Account locked              |
| `SERVICE_ERROR`    | 503         | Backend service unavailable |

---

## Rate Limits

| Endpoint            | Limit                        |
| ------------------- | ---------------------------- |
| `POST /login`       | 5 requests / minute / IP     |
| All other endpoints | 60 requests / minute / token |

---

## Related Documents

- [OpenAPI Specification](../api/openapi.yaml)
- [05-security.md](05-security.md) – Security model
- [02-architecture.md](02-architecture.md) – System architecture
