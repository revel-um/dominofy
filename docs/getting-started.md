# Local development

This guide describes running the source locally. It requires real OAuth credentials for the web startup checks; it is not a credential-free demo.

## 1. Install prerequisites

Use Node.js 22, npm 10.9.2 (the root package manager version), Python 3.11, PostgreSQL, and Redis. Run `npm ci` from the repository root. The AI service has separate Python dependencies.

If you use Docker, these commands create development-only infrastructure. The PostgreSQL volume persists data between container restarts. Change the example password for anything beyond your local machine.

```bash
docker run -d --name dominofy-postgres \
  -p 127.0.0.1:5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=dominofy-local \
  -e POSTGRES_DB=dominofy \
  -v dominofy-postgres-data:/var/lib/postgresql/data \
  postgres:16

docker run -d --name dominofy-redis \
  -p 127.0.0.1:6379:6379 redis:7
```

If these containers already exist, use `docker start dominofy-postgres dominofy-redis`.

## 2. Configure runtime credentials

The Node startup scripts load `apps/backend/config.json` and `apps/web/config.json` **before** app-level dotenv loading. Set required credentials in your shell environment or create these ignored JSON files. An `.env` file alone will not satisfy the startup preflight checks.

Create `apps/backend/config.json`:

```json
{
  "secrets": {
    "DATABASE_PASSWORD": "dominofy-local",
    "JWT_SECRET": "replace-with-a-random-secret",
    "DATABASE_HOST": "127.0.0.1",
    "DATABASE_PORT": "5432",
    "DATABASE_USER": "postgres",
    "DATABASE_NAME": "dominofy",
    "DATABASE_SCHEMA": "public",
    "REDIS_HOST": "127.0.0.1",
    "REDIS_PORT": "6379",
    "APP_WEB_URL": "http://localhost:3000",
    "PUBLIC_BACKEND_URL": "http://localhost:3001",
    "AI_SERVICE_URL": "http://localhost:8001",
    "USE_GCS_EMULATOR": "true",
    "STORAGE_EMULATOR_HOST": "http://localhost:8000"
  }
}
```

Create `apps/web/config.json`:

```json
{
  "secrets": {
    "NEXTAUTH_SECRET": "replace-with-another-random-secret",
    "GOOGLE_CLIENT_ID": "your-google-oauth-client-id",
    "GOOGLE_CLIENT_SECRET": "your-google-oauth-client-secret",
    "GITHUB_CLIENT_ID": "your-github-oauth-client-id",
    "GITHUB_CLIENT_SECRET": "your-github-oauth-client-secret",
    "NEXTAUTH_URL": "http://localhost:3000",
    "NEXT_PUBLIC_FRONTEND_BASE_URL": "http://localhost:3000",
    "NEXT_PUBLIC_BACKEND_BASE_URL": "http://localhost:3001/api/v1",
    "NEXT_PUBLIC_BACKEND_URL": "http://localhost:3001",
    "BACKEND_URL": "http://localhost:3001"
  }
}
```

Generate a separate random value for each secret, for example with `openssl rand -hex 32`. Replace OAuth placeholders with your own applications. The web preflight currently requires both Google and GitHub credential pairs, regardless of which login option you plan to use.

Register login callback URLs on your OAuth applications:

- Google: `http://localhost:3000/api/auth/callback/google`
- GitHub: `http://localhost:3000/api/auth/callback/github`

Login OAuth and workflow integration OAuth are separate configurations. Provider integrations may need additional backend credentials, scopes, callback URLs, and publicly reachable webhook endpoints. See [backend URL configuration](../apps/backend/src/config/url.config.ts) and the relevant provider module. Do not reuse the project's built-in provider defaults for your deployment.

Existing `config.json` values overwrite environment values during runtime loading. Keep the files private; they are ignored by Git. Never put private values in `NEXT_PUBLIC_*` variables, which are exposed to the browser.

## 3. Start storage and the application

In one terminal at the repository root:

```bash
npm run storage:dev
```

In another terminal at the repository root:

```bash
npm run dev
```

Turborepo starts the Next.js web app and NestJS backend. It does not start Python, PostgreSQL, Redis, or the storage emulator.

The backend inspects the database on startup. For an empty database it uses TypeORM synchronization; databases with the core tables and migration history use migrations. Use a dedicated development database. Review this behavior in `apps/backend/src/app.module.ts` before pointing it at existing data.

## 4. Start the AI service

AI generation needs your own Google API key. Create `apps/ai/config.json`:

```json
{
  "secrets": {
    "GOOGLE_API_KEY": "your-google-api-key"
  }
}
```

In a separate terminal:

```bash
cd apps/ai
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001
```

Port **8001** deliberately avoids the storage emulator's default port **8000**. The backend `AI_SERVICE_URL` must match. Calling `python main.py` uses port 8000 instead, so use the command above for this setup.

## 5. Verify the services

```bash
curl http://localhost:3001/health
curl http://localhost:8001/ping
```

Open http://localhost:3000, sign in, and configure the connections needed for your workflow. A successful health response does not verify OAuth, external provider access, or AI generation; test those with your own accounts.

## Useful commands

Run from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Node services in development mode |
| `npm run build` | Build workspace applications |
| `npm run test --workspace=backend -- --runInBand` | Run backend unit tests |
| `npm run storage:dev` | Start the local storage emulator |
| `npm run migration:run --workspace=backend` | Run backend database migrations; review database state first |

The backend lint script includes `--fix` and can modify files. The web lint script uses `next lint`; check compatibility with the installed Next.js version before relying on it as a CI gate.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing required secrets at startup | Set shell variables or the service's `config.json`; app-level dotenv loading happens later. |
| Database connection refused | Check PostgreSQL is running, port 5432 is available, and the database credentials match. |
| Redis connection errors | Check Redis is reachable on the configured host and port. |
| OAuth callback error | Match the exact scheme, hostname, port, and callback path in your provider app settings. |
| AI or storage port conflict | Keep storage on 8000, AI on 8001, and update `AI_SERVICE_URL`. |
| Webhooks do not fire locally | Most providers need a publicly reachable HTTPS endpoint and provider-side subscriptions. |
| AI generation fails despite a healthy service | Check API key validity, model access, quotas, and service logs. |

## Containers and deployment

The root `docker-compose.yml` builds web, backend, and AI images. It does **not** provision PostgreSQL or Redis. Container database and Redis hosts must point to reachable infrastructure; `localhost` inside a container means that container. Configure the required secrets and storage separately before using Compose.

`NEXT_PUBLIC_*` values are baked into the web bundle during image builds. Changing runtime variables alone will not update browser URLs. Use service-specific ports and hosts appropriate to your deployment rather than copying the local source-development settings unchanged.
