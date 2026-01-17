# Pusula UI

React + Tailwind CSS web interface for Pusula DNS management.

## Features

- 🎨 **Glassmorphism Design** - Dark, minimal, with blur panels and soft borders
- 📊 **Live Dashboard** - Real-time stats, charts, and log viewer
- 🌐 **Upstream Management** - Mode selector, provider presets, drag-and-drop ordering
- 🧪 **Self-Test** - Visual stepper UI with diagnostics
- 🔔 **Alerts** - Active alert management with acknowledge
- ⚙️ **Settings** - Password change and server info

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm

### Development

```bash
cd ui
npm install
npm run dev
```

The dev server runs at http://localhost:5173 and proxies `/api` to the backend at http://localhost:3000.

### Production Build

```bash
npm run build
```

The built assets will be in `dist/` and can be served by the backend.

## Project Structure

```
src/
├── api/
│   └── client.ts         # API client with auth
├── components/
│   ├── GlassCard.tsx     # Base glass container
│   ├── StatCard.tsx      # Metric card with skeleton
│   ├── MiniLineChart.tsx # SVG sparkline
│   ├── LogViewer.tsx     # Log display with filters
│   ├── ModeBadge.tsx     # Resolver mode badge
│   ├── ConfirmModal.tsx  # Confirmation dialog
│   ├── ActionButton.tsx  # Button with loading
│   ├── Sidebar.tsx       # Navigation sidebar
│   └── ProviderList.tsx  # Upstream provider list
├── hooks/
│   ├── useAuth.tsx       # Auth context
│   └── useToast.tsx      # Toast notifications
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── UpstreamsPage.tsx
│   ├── SelfTestPage.tsx
│   ├── AlertsPage.tsx
│   └── SettingsPage.tsx
├── styles/
│   └── globals.css       # Tailwind + glass utilities
├── App.tsx               # Main app with routing
└── main.tsx              # Entry point
```

## Design System

### Colors

- **Background**: slate-950 gradient
- **Cards**: slate-900/60 with backdrop blur
- **Borders**: slate-700/50
- **Accent**: blue-500 (primary), emerald-500 (success), red-500 (danger)

### Components

All major components follow the Glassmorphism style with:

- Translucent backgrounds
- Subtle borders
- Backdrop blur
- Soft glows on hover

## API Integration

The UI communicates with the backend via `/api` endpoints:

| Endpoint                | Usage               |
| ----------------------- | ------------------- |
| POST /api/login         | Authentication      |
| GET /api/unbound/status | Status polling (5s) |
| GET /api/unbound/stats  | Stats polling (3s)  |
| GET /api/unbound/logs   | Log following (2s)  |
| GET /api/alerts         | Alert polling (15s) |

## License

MIT
