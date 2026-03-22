# BenchMaster MVP

BenchMaster is a mobile-first MVP for basketball coaches and assistant coaches who need a fast way to manage playing time during games. This version implements only Axis 1: roster setup, game setup, live substitutions, and final playing-time summaries.

## Stack

- Frontend: Angular 21 standalone app
- Mobile UI style: Ionic-inspired cards, toolbars, pill selectors, and thumb-friendly tap targets
- Backend: Node.js + Express REST API
- Database: PostgreSQL with Prisma ORM

## Project Structure

```text
BenchMaster/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── index.ts
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   └── shared/
│   │   └── styles.scss
│   ├── angular.json
│   └── package.json
│
├── package.json
└── README.md
```

## MVP Features

- Team management: create, edit, and delete teams
- Roster management: add, edit, and delete players
- Game setup: pick available players and define the starting five
- Live Match: start, pause, resume, substitute, and end a game
- Automatic playing-time tracking per player
- Final summary: mobile-friendly comparison of total minutes played

## Axis 2 Preparation

Axis 2 is intentionally not implemented yet. Relevant TODO comments are already placed in:

- `backend/prisma/schema.prisma`
- `backend/src/services/time-tracking.service.ts`
- `frontend/src/app/pages/live-match/live-match.page.ts`
- `frontend/src/app/pages/game-summary/game-summary.page.ts`

These TODOs reserve space for future points, rebounds, assists, shooting, efficiency, and time-segment-linked statistics.

## Setup

### Node.js version

This project requires Node.js `20.19.0` or newer because the frontend uses Angular CLI 21.

The repository now includes `.nvmrc` and `.node-version`, so any compatible Node version manager can pick the right runtime automatically.

If you use a shell-based `nvm` setup, run this once from the project root before installing dependencies:

```bash
nvm use
```

### 1. Install dependencies

Run from the project root:

```bash
npm install
```

### 2. Create the local PostgreSQL database

Make sure your local PostgreSQL service is running, then create the development database once:

```bash
createdb benchmaster
```

### 3. Generate Prisma client, apply migrations, and seed the database

```bash
npm run db:setup
```

The backend expects a PostgreSQL connection string in `backend/.env`. The default local format is:

```bash
DATABASE_URL="postgresql://USER@localhost:5432/benchmaster?schema=public"
```

### 4. Run the backend API

```bash
npm run dev:backend
```

The API will start on [http://localhost:3000](http://localhost:3000).

### 5. Run the frontend

In another terminal:

```bash
npm run dev:frontend
```

The Angular app will start on [http://localhost:4200](http://localhost:4200).

## Key API Endpoints

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
- `POST /api/games/:gameId/start`
- `POST /api/games/:gameId/pause`
- `POST /api/games/:gameId/resume`
- `POST /api/games/:gameId/substitutions`
- `POST /api/games/:gameId/end`
- `GET /api/games/:gameId/summary`

## Main Technical Decisions

- Playing time logic is isolated in backend services so timers never depend on Angular components.
- Live substitutions use a two-step mobile flow: select bench player first, then tap the player leaving the court.
- PostgreSQL + Prisma keeps the local and production environments aligned while leaving room for richer stat models later.
- Angular standalone components keep the frontend modular and easy to extend without extra NgModule ceremony.
- The Live Match screen is the central workflow and uses minimal text input during active game usage.

## CI/CD

The repository now includes two GitHub Actions workflows:

- `CI`: installs dependencies, generates the Prisma client, builds the backend, and builds the frontend.
- `CD Render`: triggers Render deployments after a successful `CI` run on the `main` branch.

### GitHub Actions

Workflows are defined in:

- `.github/workflows/ci.yml`
- `.github/workflows/cd-render.yml`

### Required GitHub Secrets

Add these repository secrets before enabling production deploys:

- `RENDER_API_DEPLOY_HOOK_URL`
- `RENDER_WEB_DEPLOY_HOOK_URL`

You can create each deploy hook from the Render dashboard in the corresponding service:

1. Open the service.
2. Go to `Settings`.
3. Create or copy a `Deploy Hook`.
4. Save the hook URL in the matching GitHub secret.

### Deployment Flow

1. A push or pull request starts `CI`.
2. If `CI` succeeds on `main`, `CD Render` triggers both Render services.
3. Render then builds and deploys using `render.yaml`.
