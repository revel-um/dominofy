# Dominofy backend

The NestJS API manages workflows, workspaces, provider connections, scheduling, logging, and domino execution. It uses PostgreSQL, Redis, and Cloud Storage or the local storage emulator.

Follow the [repository setup guide](../../docs/getting-started.md). Run commands from the repository root:

```bash
npm run dev --workspace=backend
npm run build --workspace=backend
npm run test --workspace=backend -- --runInBand
```

The default API base is http://localhost:3001/api/v1. Configure database and authentication environment variables before starting.

- `src/domino-engine/`: graph execution, registry, and domino handlers.
- `src/migrations/`: TypeORM migrations.
- Provider modules: OAuth, webhook, and integration-specific logic.

Read [architecture](../../docs/architecture.md) and the [database setup notes](../../docs/getting-started.md#2-configure-the-backend) before changing persistence behavior. The lint script uses `--fix` and modifies files.
