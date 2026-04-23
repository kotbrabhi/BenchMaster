# BenchMaster

BenchMaster is a mobile-first basketball coaching app built to prepare rosters, launch games quickly, track rotations live, and review player usage after the final buzzer.

The repository is a JavaScript/TypeScript monorepo with:

- an Angular 21 frontend
- an Express + Prisma backend
- a PostgreSQL database
- Render deployment configuration

## What The App Does Today

BenchMaster already goes beyond the initial MVP scope.

- Guest mode: one team and one game stored locally in the browser
- Authenticated mode: sign up, sign in, and persist data in PostgreSQL
- Team management: create, edit, and delete teams
- Roster management: add, edit, and delete players
- Game setup: select available players and define the starting five
- Live match flow: start, pause, resume, substitute players, end a game
- Period workflow: close the current period and start the next one
- Live stat capture: points, assists, rebounds, blocks, and fouls
- Correction support for live stat adjustments
- Rotation timeline: period starts, substitutions, period ends, and game end events
- Game summary: total playing time, starter/bench split, and usage insights
- Bilingual UI: French and English

## Stack

- Frontend: Angular 21 standalone app
- Backend: Node.js + Express
- ORM: Prisma
- Database: PostgreSQL
- Tooling: npm workspaces, TypeScript, tsx
- Deployment: Render Blueprint via [`render.yaml`](./render.yaml)

## Project Structure

```text
BenchMaster/
├── backend/
│   ├── prisma/
│   ├── src/
│   │   ├── auth/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
├── frontend/
│   ├── public/
│   ├── scripts/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   └── shared/
│   │   └── environments/
│   └── package.json
├── .github/workflows/
├── scripts/
├── package.json
├── render.yaml
└── README.md
```

## Requirements

- Node.js `20.19.0` or newer
- npm `10.8.2` or newer
- PostgreSQL running locally

Version files are included for common managers:

- `.nvmrc`
- `.node-version`
- `.tool-versions`

Check your runtime at any time with:

```bash
npm run check:node
```

## Quick Start

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Create local environment files

Create these two files from the examples:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend example:

```env
DATABASE_URL="postgresql://USER@localhost:5432/benchmaster?schema=public"
PORT=3000
FRONTEND_ORIGIN="http://localhost:4200"
AUTH_TOKEN_SECRET="change-me-in-production"
```

Frontend example:

```env
API_BASE_URL="http://localhost:3000/api"
```

### 3. Create the database

```bash
createdb benchmaster
```

### 4. Apply migrations and generate Prisma client

```bash
npm run db:setup
```

This command:

- generates the Prisma client
- applies all backend migrations
- runs the backend seed script

Note: authenticated API data is scoped per user account. After registering in the app, create your own team to work in signed-in mode.

### 5. Start the backend

```bash
npm run dev:backend
```

The API runs on [http://localhost:3000](http://localhost:3000).

### 6. Start the frontend

In another terminal:

```bash
npm run dev:frontend
```

The web app runs on [http://localhost:4200](http://localhost:4200).

## Available Root Scripts

- `npm run check:node`: verify the required Node.js version
- `npm run dev:backend`: start the backend in watch mode
- `npm run dev:frontend`: start the frontend dev server
- `npm run build`: build backend and frontend
- `npm run db:migrate`: run Prisma development migrations in the backend workspace
- `npm run db:setup`: generate Prisma client, deploy migrations, and seed the database
- `npm run db:seed`: rerun the backend seed script

## API Overview

### Public endpoints

- `GET /healthz`
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/public/game-shares/:shareId`

### Protected endpoints

All remaining `/api/*` routes require authentication.

- `GET /api/auth/me`
- `GET /api/teams`
- `POST /api/teams`
- `PUT /api/teams/:teamId`
- `DELETE /api/teams/:teamId`
- `GET /api/teams/:teamId/players`
- `POST /api/teams/:teamId/players`
- `PUT /api/players/:playerId`
- `DELETE /api/players/:playerId`
- `GET /api/games`
- `POST /api/games`
- `GET /api/games/:gameId`
- `GET /api/games/:gameId/players`
- `GET /api/games/:gameId/summary`
- `POST /api/games/:gameId/share`
- `POST /api/games/:gameId/start`
- `POST /api/games/:gameId/pause`
- `POST /api/games/:gameId/resume`
- `POST /api/games/:gameId/periods/complete`
- `POST /api/games/:gameId/periods/start`
- `POST /api/games/:gameId/substitutions`
- `POST /api/games/:gameId/players/:playerId/points`
- `POST /api/games/:gameId/players/:playerId/stats`
- `POST /api/games/:gameId/end`

## Product Notes

- Guest mode works entirely from browser storage and is limited to one local team and one local game.
- Authenticated mode syncs through the API and scopes teams and games to the signed-in user.
- Playing-time logic lives in backend services so match timing does not depend on frontend state.
- Team labels adapt to the selected gender (`MIXED`, `FEMININE`, `MASCULINE`).

## CI/CD

The repository includes two GitHub Actions workflows:

- `CI`: installs dependencies, generates Prisma client, and builds both apps
- `CD Render`: triggers Render deploy hooks after a successful `CI` run on `main`

Workflow files:

- `.github/workflows/ci.yml`
- `.github/workflows/cd-render.yml`

Required GitHub secrets for deployment:

- `RENDER_API_DEPLOY_HOOK_URL`
- `RENDER_WEB_DEPLOY_HOOK_URL`

## Render Deployment

[`render.yaml`](./render.yaml) defines:

- `benchmaster-api`: Node web service
- `benchmaster-web`: static frontend service

The backend service expects:

- `DATABASE_URL`
- `FRONTEND_ORIGIN`

The frontend service expects:

- `API_BASE_URL`

## Current Roadmap Direction

The codebase already contains groundwork for deeper stat tracking and richer post-game analysis. The next logical step is to connect live stat events more tightly to time segments and advanced game insights.
