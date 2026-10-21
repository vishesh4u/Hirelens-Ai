# HireLens AI

AI-assisted resume screening and candidate shortlisting: upload resumes, score candidates against a job with a
transparent deterministic engine, rank and compare them, generate interview questions, and keep an audit trail.
The scoring engine decides the numbers; AI is optional and only writes summaries and questions.

```text
Browser (frontend/)  ──REST/JSON + JWT──▶  Express API (Backend/)  ──Mongoose──▶  MongoDB
                                                │
                                                ├─ resume parser · job analyzer · scoring engine
                                                └─ AI service (optional, deterministic fallback)
```

## Repository layout
```text
HireLens-AI/
├── frontend/                 static single-page app, plain browser JavaScript (no build step)
│   ├── index.html            login markup + <link>/<script> tags
│   ├── css/  styles.css (tokens, base, layout)  components.css (tables, modals, reports, workspace)
│   └── js/   config · api · state · scoring · router · views · actions · app   (loaded in this order)
├── Backend/                  Node.js + Express + MongoDB API (see Backend/README.md)
└── README.md
```

## Frontend
- Classic `<script>` files sharing global scope (not ES modules), so it also works when `frontend/index.html`
  is opened directly from disk. Load order is fixed in `index.html`; each file only needs files above it at load time.
  - `config.js` API base URL, token storage key, default scoring weights, status list.
  - `api.js` `apiFetch` (Bearer token, error handling), the `API` object (one function per backend endpoint),
    `fetchAllPages` (the backend returns at most 100 rows per page), data adapters, `remoteFetch` cache.
  - `state.js` demo dataset, `localStorage` persistence, UI state, shared helpers.
  - `scoring.js` browser copy of the scoring engine (same formula as the backend) used for instant UI and as the offline fallback.
  - `router.js` hash routing and `render()`. `views.js` every page, modal and chart. `actions.js` click/form actions.
    `app.js` event listeners and startup.
- Dark theme by default, light theme available. Pages: Dashboard, Jobs, Candidates, Screening, Ranking, Simulator,
  Compare, Interview, Reports, Analytics, Evaluation, Fairness, Audit, Settings.
- **API base URL** (`config.js`): `window.HIRELENS_API_BASE_URL` if set; `http://localhost:3000/api` when opened as
  `file://` or from another dev server port; otherwise same-origin `/api` (the normal case when Express serves the frontend).
- **Offline/demo mode:** if the server is unreachable, "Continue with Demo Account" (or `demo@hirelens.ai` / `password`)
  runs entirely in the browser on the bundled demo data. The simulator always runs in the browser.
- MongoDB ids are strings; the frontend never converts them to numbers.
- In the browser console: `runSelfTest()` runs the built-in self-test; `HireLens.resetData()` clears local data and the token.

## Backend
Express app in `Backend/src` (routes → controllers → services → models). Full endpoint table, security notes and
resume-upload behaviour are in [Backend/README.md](Backend/README.md). Express also serves `frontend/` as static
files at `/`, so `http://localhost:3000` gives the app and the API on one origin; `/api/*` is unchanged.

## MongoDB
Database `hirelens_ai` (name fixed in `Backend/src/config/db.js`), collections `users`, `jobs`, `candidates`,
`screenings`, `auditlogs`. Set `MONGODB_URI` (local MongoDB or Atlas). Uploaded resume files are parsed in memory and
discarded; only extracted text, structured fields and file metadata are stored.

## Authentication
`POST /api/auth/register` and `/login` return a JWT (bcrypt-hashed passwords, `JWT_SECRET`, default 7-day expiry).
The frontend keeps the token in `localStorage` and sends `Authorization: Bearer <token>`; a 401 clears it.
Registration always creates a `recruiter`; data is scoped per user. Auth routes are rate limited.

## Screening engine
`Backend/src/services/scoringEngine.js` is deterministic and is the only thing that produces scores:
`overall = skills×0.35 + experience×0.20 + semantic×0.25 + education×0.10 + projects×0.10` (weights configurable, must
total 100%). Every result lists matched / partial / missing skills, strengths, gaps and evidence taken from the actual
candidate and job data. Gender, religion, caste, race, age, photograph and marital status are never used.
A test checks that the backend and `frontend/js/scoring.js` give identical scores on the demo data.

## AI service
`Backend/src/services/aiService.js` (optional; needs `AI_API_KEY` and `AI_MODEL`) writes recruiter summaries, interview
questions and job-analysis hints from already-computed facts. It never changes a score, keys stay on the server, and
every call falls back to deterministic output if AI is unconfigured or fails.

## API (all under `/api`, JWT required except health and auth)
`GET /health` · `POST /auth/register|login`, `GET /auth/me` · `/jobs` CRUD, `POST /jobs/:id/analyze`,
`GET /jobs/:id/ranking`, `POST /jobs/:id/ranking/simulate` · `/candidates` CRUD, `POST /candidates/upload|compare`
· `POST /screen` · `POST /interview/questions` · `GET /reports/:candidateId?jobId=` · `GET /analytics`, `GET /audit-logs`.
The ranking endpoint lists only candidates that have been screened for that job.

## Run locally
```bash
cd Backend
cp .env.example .env     # set MONGODB_URI and JWT_SECRET (e.g. openssl rand -hex 32)
npm install
npm run seed             # optional, dev only: demo@hirelens.ai / password with demo jobs and candidates
npm start                # http://localhost:3000  -> app at /, API at /api, health at /api/health
npm test                 # logic tests; the API integration suite also runs after npm install
```
To use only the frontend, open `frontend/index.html` (it talks to `http://localhost:3000/api` if the backend is running,
otherwise use the demo account).

## Environment variables (`Backend/.env`)
| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | signs JWTs; never commit |
| `PORT`, `NODE_ENV` | no | default `3000`, `development` |
| `JWT_EXPIRES_IN` | no | default `7d` |
| `CLIENT_URL` | production | comma-separated allowed browser origins (not needed when Express serves the frontend) |
| `AI_API_KEY`, `AI_MODEL` | no | enable AI summaries/questions; `AI_PROVIDER` (`anthropic` default or `openai`), `AI_BASE_URL`, `AI_EMBEDDING_MODEL` optional |

Deploying (Render/Railway): the Express app expects the repository root so it can find `frontend/` next to `Backend/`
(start command `npm start` from `Backend`, health check `/api/health`). If only `Backend/` is deployed, the API still
works and the frontend must be hosted separately with `window.HIRELENS_API_BASE_URL` and `CLIENT_URL` set.
