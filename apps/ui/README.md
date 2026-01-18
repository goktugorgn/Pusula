# Pusula UI

React + Vite + Tailwind CSS frontend for Unbound DNS management.

## Quick Start

```bash
cd apps/ui
npm install
npm run dev
```

Dev server at http://localhost:5173 (proxies API to :3000)

---

## Local Development (macOS)

To run the full stack locally without Unbound/systemd:

### 1. Setup Backend DEV Mode

```bash
# From repo root
./scripts/setup-local-dev.sh

cd apps/backend
cp .env.dev .env
npm install
npm run dev
```

### 2. Start UI

```bash
cd apps/ui
npm install
npm run dev
```

### 3. Open Browser

Open http://localhost:5173 and login with:

- **Username**: admin
- **Password**: admin

### 4. Run Smoke Test (optional)

```bash
./scripts/local-smoke-test.sh
```

### Environment Variables

Create `.env` from `.env.example` if you need custom config:

| Variable            | Default | Description               |
| ------------------- | ------- | ------------------------- |
| `VITE_API_BASE_URL` | `/api`  | Backend API URL (proxied) |

---

## Tech Stack

| Technology     | Version | Purpose                 |
| -------------- | ------- | ----------------------- |
| React          | 18+     | UI framework            |
| Vite           | 7+      | Build tool              |
| Tailwind CSS   | 4+      | Glassmorphism styling   |
| TanStack Query | 5+      | Data fetching + caching |
| React Router   | 6+      | Client routing          |

## Pages

| Route        | Page      | Description               |
| ------------ | --------- | ------------------------- |
| `/login`     | Login     | Authentication            |
| `/`          | Dashboard | Status, stats, alerts     |
| `/upstreams` | Upstreams | Mode selector, providers  |
| `/self-test` | Self-Test | Step-by-step diagnostics  |
| `/logs`      | Logs      | Log viewer with filters   |
| `/alerts`    | Alerts    | Alert list + ack          |
| `/settings`  | Settings  | Password, service actions |

## Project Structure

```
src/
├── api/                # API client + hooks
│   ├── client.ts       # Fetch wrapper with auth
│   ├── hooks.ts        # TanStack Query hooks
│   ├── types.ts        # OpenAPI types
│   └── index.ts
├── components/         # Shared components
│   ├── AppShell.tsx    # Layout with sidebar
│   └── ProtectedRoute.tsx
├── pages/              # Page components
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── Upstreams.tsx
│   ├── SelfTest.tsx
│   ├── Logs.tsx
│   ├── Alerts.tsx
│   └── Settings.tsx
├── App.tsx             # Routes + QueryClient
├── main.tsx            # Entry point
└── index.css           # Glassmorphism theme
```

## Scripts

| Script            | Description      |
| ----------------- | ---------------- |
| `npm run dev`     | Dev server       |
| `npm run build`   | Production build |
| `npm run preview` | Preview prod     |
| `npm run lint`    | Lint check       |

## API Polling

| Endpoint          | Interval |
| ----------------- | -------- |
| `/unbound/status` | 10s      |
| `/unbound/stats`  | 5s       |
| `/alerts`         | 30s      |
| `/pihole/summary` | 60s      |

## Theme

Glassmorphism with:

- Dark gradient background
- Blur glass cards
- Smooth transitions
- Status indicators
