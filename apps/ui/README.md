# Pusula UI

React + Vite + Tailwind CSS frontend for Unbound DNS management.

## Quick Start

```bash
cd apps/ui
npm install
npm run dev
```

Dev server at http://localhost:5173 (proxies API to :3000)

## Tech Stack

| Technology     | Version | Purpose                 |
| -------------- | ------- | ----------------------- |
| React          | 18+     | UI framework            |
| Vite           | 7+      | Build tool              |
| Tailwind CSS   | 4+      | Styling (Glassmorphism) |
| TanStack Query | 5+      | Data fetching           |
| React Router   | 6+      | Routing                 |

## Pages

| Route       | Description      |
| ----------- | ---------------- |
| `/login`    | Authentication   |
| `/`         | Dashboard        |
| `/settings` | Upstream config  |
| `/logs`     | Log viewer       |
| `/alerts`   | Alert management |

## Scripts

| Script            | Description      |
| ----------------- | ---------------- |
| `npm run dev`     | Dev server       |
| `npm run build`   | Production build |
| `npm run preview` | Preview prod     |

## API Integration

Uses httpOnly cookie auth with TanStack Query hooks:

- `useUnboundStatus()` - 10s polling
- `useUnboundStats()` - 5s polling
- `useAlerts()` - 30s polling
- `usePiholeSummary()` - 60s polling

## Structure

```
src/
├── api/          # Client + hooks + types
├── components/   # Reusable components
├── pages/        # Page components
├── index.css     # Glassmorphism theme
└── App.tsx       # Routes + QueryClient
```
