# Dominofy web

The Next.js and React application contains the visual workflow editor, domino configuration components, workspace UI, and NextAuth routes.

Follow the [repository setup guide](../../docs/getting-started.md) for credentials, infrastructure, and service URLs. Run commands from the repository root:

```bash
npm run dev --workspace=web
npm run build --workspace=web
```

Development serves http://localhost:3000. Start the backend separately when running only this workspace.

- `dominos/`: editor components and the catalog in `dominos.ts`.
- `pages/`: application pages and API routes, including authentication.
- `public/`: static assets.

The runtime startup hook requires NextAuth, Google, and GitHub credentials before Next.js starts. `NEXT_PUBLIC_*` values are browser-visible and are embedded during production builds. See the [architecture guide](../../docs/architecture.md) before adding new domino types.
