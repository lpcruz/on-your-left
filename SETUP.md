# Setup Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Quick Start

### 1. Install dependencies

```bash
# Root (concurrently runner)
npm install

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env and set DATABASE_URL to your PostgreSQL connection string

# Frontend (optional — enables Mapbox map)
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local and add your Mapbox public token
```

### 3. Set up the database

```bash
# Create the schema
npm run db:setup

# Seed historical crowd data
npm run db:seed
```

### 4. Run the app

```bash
# Runs backend (port 3001) + frontend (port 5173) concurrently
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Architecture

```
on-your-left/
├── backend/          Node.js + Express API
│   ├── src/
│   │   ├── db/       Schema, pool, setup, seed scripts
│   │   ├── routes/   Express route handlers + route metadata
│   │   └── server.js Entry point
│   └── .env.example
│
└── frontend/         React + Vite + Tailwind
    ├── src/
    │   ├── components/  RouteCard, ReportButton, RouteMap, etc.
    │   ├── hooks/       useRoutes, useRoute, submitReport
    │   ├── lib/         Status config + helpers
    │   └── pages/       Home, RoutePage
    └── .env.example
```

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/routes` | All routes with current status |
| `GET` | `/api/routes/:id` | Single route detail + breakdown |
| `POST` | `/api/routes/:id/report` | Submit a crowd report |

### POST /api/routes/:id/report

```json
{ "status": "empty" | "moderate" | "packed" }
```

## Mapbox Setup (Optional)

The app works without Mapbox — route detail pages show a placeholder where the map would be. To enable:

1. Create a free account at [mapbox.com](https://mapbox.com)
2. Copy your public token
3. Add it to `frontend/.env.local`:
   ```
   VITE_MAPBOX_TOKEN=pk.eyJ1...
   ```

## Routes (MVP)

| ID | Name | Location |
|----|------|----------|
| `hoboken-waterfront` | Hoboken / Weehawken Waterfront | Hoboken & Weehawken, NJ |
| `liberty-state-park` | Liberty State Park Promenade | Jersey City, NJ |
| `saddle-river` | Saddle River County Park | Ridgewood / Saddle Brook, NJ |
| `overpeck` | Overpeck County Park | Leonia / Englewood, NJ |
