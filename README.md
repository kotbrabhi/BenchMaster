# BenchMaster MVP

BenchMaster is a mobile-first MVP for basketball coaches and assistant coaches who need a fast way to manage playing time during games. This version implements only Axis 1: roster setup, game setup, live substitutions, and final playing-time summaries.

## Stack

- Frontend: Angular 21 standalone app
- Mobile UI style: Ionic-inspired cards, toolbars, pill selectors, and thumb-friendly tap targets
- Backend: Node.js + Express REST API
- Database: SQLite with Prisma ORM

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

### 1. Install dependencies

Run from the project root:

```bash
npm install
```

### 2. Generate Prisma client and create the SQLite database

```bash
npm run db:setup
```

`prisma migrate dev` is scaffolded in the backend package, but in this environment Prisma's schema engine returned a generic error while applying SQLite DDL. The checked-in SQL migration is the reliable path used for this MVP bootstrap.

### 3. Run the backend API

```bash
npm run dev:backend
```

The API will start on [http://localhost:3000](http://localhost:3000).

### 4. Run the frontend

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
- SQLite + Prisma keeps the MVP simple while leaving room for richer stat models later.
- Angular standalone components keep the frontend modular and easy to extend without extra NgModule ceremony.
- The Live Match screen is the central workflow and uses minimal text input during active game usage.
