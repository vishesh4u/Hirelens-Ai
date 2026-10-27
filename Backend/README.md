# HireLens AI — Backend

Node.js + Express + MongoDB (Mongoose) REST API for the HireLens AI frontend (`../frontend`). Overview: [../README.md](../README.md).
JavaScript only. JWT auth. Deterministic, explainable scoring; AI is an optional enhancement.

## Quick start
```bash
cd Backend
cp .env.example .env        # fill MONGODB_URI and JWT_SECRET (e.g. `openssl rand -hex 32`)
npm install
npm run seed                # optional, dev only: demo@hirelens.ai + demo jobs/candidates
npm start                   # http://localhost:3000  (also serves ../frontend at "/")
npm test                    # logic + AI-fallback tests; API tests need `npm install` first
```
Deploy (Render/Railway): build `npm install`, start `npm start` (from `Backend`), health check `/api/health`. To have Express also serve the app, deploy the whole repository (so `frontend/` sits next to `Backend/`); with only `Backend/` deployed the API works but `/` is not served.
Set `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CLIENT_URL` (your frontend origin) in the platform's env settings.

## Environment
| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | yes | database name is fixed to `hirelens_ai` |
| `JWT_SECRET` | yes | never commit; `JWT_EXPIRES_IN` defaults to `7d` |
| `PORT` | no | provided by the platform; default 3000 |
| `CLIENT_URL` | prod | comma-separated allowed origins; in production with no value, cross-origin requests are refused |
| `AI_API_KEY`, `AI_MODEL` | no | enable AI summaries / interview questions / job-analysis enhancement |
| `AI_PROVIDER` | no | `anthropic` (default) or `openai` (any OpenAI-compatible API; `AI_BASE_URL` to override) |
| `AI_EMBEDDING_MODEL` | no | openai-compatible only; blends embedding similarity (60%) with lexical similarity (40%) into the *semantic* component |

## API
All responses: `{ "success": true, "data": ... }` or `{ "success": false, "message": "..." }`. Everything except `/api/health` and `/api/auth/register|login` needs `Authorization: Bearer <jwt>`. Data is scoped per user (admins see all).

| Method & path | Purpose |
|---|---|
| `GET /api/health` | `{status, database}`; 503 if DB not connected |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | auth (bcrypt, JWT; register always creates a `recruiter`; rate limited) |
| `GET/POST /api/jobs`, `GET/PUT/DELETE /api/jobs/:id` | jobs; requirements are auto-extracted from the description when none are given |
| `POST /api/jobs/:id/analyze` | (re)analyze the job description |
| `GET /api/jobs/:id/ranking?sort=score\|skills\|experience\|relevance\|status` | ranking from saved screenings |
| `POST /api/jobs/:id/ranking/simulate` `{weights}` | what-if weights → `originalRank`, `simulatedRank`, `rankChange`; nothing is saved |
| `GET/POST /api/candidates`, `GET/PUT/DELETE /api/candidates/:id` | filters: `job, status, minimumScore, skill, search, page, limit` |
| `POST /api/candidates/upload` | multipart `resume` (PDF/DOCX ≤ 5 MB) + optional `name,email,phone,location,job` |
| `POST /api/candidates/compare` `{candidateIds, jobId}` | side-by-side scores; no winner is declared |
| `POST /api/screen` `{candidateId, jobId, weights?}` | screen + save; `GET /api/screen` lists history |
| `POST /api/interview/questions` `{candidateId, jobId}` | `technical, behavioral, project, followUp, source` |
| `GET /api/reports/:candidateId?jobId=` | structured report data |
| `GET /api/analytics`, `GET /api/audit-logs` | computed from MongoDB |

## How scoring works
```
Resume → structured candidate → skill normalization → job requirements → matching → weighted score
```
`overall = skills×0.35 + experience×0.20 + semantic×0.25 + education×0.10 + projects×0.10` (weights configurable, must total 100%; fractions or percentages accepted). The code in `services/scoringEngine.js` is a port of the frontend engine and a test asserts identical scores on the frontend's demo data (`frontend/js/scoring.js`). **AI never sets a score.** AI only words summaries/questions from already-computed facts, and every AI call has a deterministic fallback, so the app works with no AI key or when the provider is down.

## Fairness / responsible screening
Ranking uses **only** skills, experience, job relevance, education and projects. Gender, religion, caste, race, age, photograph and marital status are never extracted, stored for scoring, or used in ranking (a test verifies that adding such fields does not change scores). AI prompts explicitly forbid using them. Output is decision support; the recruiter makes the final decision.

## Resume uploads
PDF/DOCX are validated (extension, MIME type, magic bytes, size), parsed **in memory**, and discarded. MongoDB stores the extracted text, structured fields and file metadata only (free hosts have ephemeral disks, so files would not persist anyway). Scanned/image-only PDFs are rejected (no OCR). The parser is heuristic; uncertain fields stay empty and the raw text is kept. Recruiters should review parsed profiles.

## Frontend integration
The frontend (`../frontend`, plain browser JavaScript) is connected to this API through its `API` object in
`frontend/js/api.js`: login/register, jobs, candidates, resume upload, screening, ranking, compare, interview questions,
reports, analytics and audit logs. Express serves `../frontend` as static files on the same origin (registered after the
`/api` routes). The simulator stays in the browser, and each screen falls back to the in-browser engine when the server
is unreachable. List requests are paged client-side because this API caps `limit` at 100.

## Audit actions
`LOGIN, USER_REGISTERED, JOB_CREATED/UPDATED/DELETED/ANALYZED, CANDIDATE_CREATED/UPDATED/DELETED, CANDIDATE_SHORTLISTED, CANDIDATE_REJECTED, RESUME_UPLOADED, SCREENING_COMPLETED, INTERVIEW_QUESTIONS_GENERATED, REPORT_GENERATED`.

## Security notes
bcrypt (cost 12), JWT, helmet, CORS allow-list, request size limits, whitelisted fields (no mass assignment), regex-escaped searches, generic login errors, auth rate limiting, no stack traces in production, passwords/keys never logged or returned.
