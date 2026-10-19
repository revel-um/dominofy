# Local development

Use Node.js 22, npm 10.9.2, Python 3.11, and Docker. Run commands from the repository root unless specified otherwise.

## 1. Install dependencies and infrastructure

```bash
npm ci
docker compose up -d postgres redis gcs
```

The included Compose configuration exposes PostgreSQL on **5433**, Redis on **6379**, and the storage emulator on **8000**. It uses development database credentials and a persistent PostgreSQL volume. Use isolated local data.

## 2. Configure the backend

Create `apps/backend/.env` (ignored by Git):

```dotenv
DATABASE_HOST=127.0.0.1
DATABASE_PORT=5433
DATABASE_USER=dominofy
DATABASE_PASSWORD=secret
DATABASE_NAME=dominofy
DATABASE_SCHEMA=public
JWT_SECRET=replace-with-a-random-secret
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
GOOGLE_CLOUD_PROJECT=local-gcp
GCS_BUCKET=dominofy-local
STORAGE_EMULATOR_HOST=http://localhost:8000
GCS_PUBLIC_BASE=http://localhost:8000
FRONTEND_BASE_URL=http://localhost:3000
```

Generate a private random secret using `openssl rand -hex 32`. The backend uses TypeORM `synchronize: true`, so do not point it at an existing production database. Provider connections need additional credentials and provider-specific scopes and callbacks; inspect the relevant backend provider module before configuring them.

## 3. Configure the web application

Create `apps/web/.env.local` (ignored by Git):

```dotenv
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-different-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_AI_BASE_URL=http://localhost:8001
```

Use your own OAuth applications. Register login callbacks `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/github` with the corresponding providers. Login and workflow integration authentication are separate configurations. Never put private values into `NEXT_PUBLIC_*` variables.

## 4. Start the applications

```bash
npm run dev
```

Turborepo starts the web and backend applications. Open http://localhost:3000. The backend API base is http://localhost:3001/api/v1. Python runs separately.

## 5. Start AI generation

Create `apps/ai/.env` with your own `GOOGLE_API_KEY`, then run in a separate terminal:

```bash
cd apps/ai
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

AI uses port **8001** to avoid the storage emulator on **8000**. The web setting `NEXT_PUBLIC_AI_BASE_URL` must match. Check availability with `curl http://localhost:8001/ping`; health alone does not verify generation credentials, quotas, or provider connections.

## Validation and troubleshooting

```bash
npm run test --workspace=backend -- --runInBand
npm run build
```

The backend lint script auto-fixes files. The web lint script uses `next lint`; verify compatibility before treating it as a CI gate.

| Problem | Check |
| --- | --- |
| Database connection refused | Use port 5433 for local source development; Compose containers use postgres:5432. |
| OAuth callback error | Match the exact callback scheme, hostname, port, and path. |
| AI request reaches storage | Set NEXT_PUBLIC_AI_BASE_URL to http://localhost:8001 and restart the web app. |
| Webhooks do not arrive | Providers generally require a publicly reachable HTTPS endpoint. |
| Build or provider call fails | Check service logs, required credentials, provider permissions, and network access. |

## Container applications

Compose also defines backend and frontend services. These use `apps/backend/.env` and `apps/web/.env` respectively; the frontend container does not consume the source-development `.env.local` through its Compose env_file setting. Inspect Dockerfiles and build-time public URLs before using the container application setup. The AI service is not included in this Compose file.
