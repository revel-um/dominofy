# Dominofy backend

The NestJS API manages workflows, workspaces, provider connections, scheduling, logging, and domino execution. It uses PostgreSQL, Redis, and Cloud Storage or the local storage emulator.

Follow the [repository setup guide](../../docs/getting-started.md). Run commands from the repository root:

```bash
npm run dev --workspace=backend
npm run build --workspace=backend
npm run test --workspace=backend -- --runInBand
```

The default API base is http://localhost:3001/api/v1; health is available at http://localhost:3001/health. The startup hook requires `DATABASE_PASSWORD` and `JWT_SECRET` before NestJS loads.

- `src/domino-engine/`: graph execution, registry, and domino handlers.
- `src/config/`: environment defaults and provider callback URLs.
- `src/migrations/`: TypeORM migrations.
- Provider modules: OAuth, webhook, and integration-specific logic.

Read [architecture](../../docs/architecture.md) and the [database bootstrap notes](../../docs/getting-started.md#3-start-storage-and-the-application) before changing persistence behavior. The lint script uses `--fix` and modifies files.
