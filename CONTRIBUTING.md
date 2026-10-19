# Contributing to Dominofy

Thanks for helping improve Dominofy. Useful contributions include reproducible bug reports, setup improvements, integration fixes, and focused features.

## Before you start

Read the [README](README.md), [local setup](docs/getting-started.md), and [architecture](docs/architecture.md). The repository does not yet declare a project-wide license; please consider that before contributing or redistributing code.

For a substantial feature, open an issue describing the problem, intended behavior, and proposed scope before investing in a large implementation. For small fixes, a focused pull request is welcome.

## Development workflow

1. Fork the repository and create a branch for your change.
2. Install dependencies with `npm ci` from the root and follow the setup guide.
3. Follow surrounding TypeScript, React, NestJS, or Python conventions. Reuse existing domino structures and provider patterns.
4. Add or update tests for behavior changes. Check errors and validation, not only successful execution.
5. Run the relevant checks and include their exact results in your pull request.

```bash
npm run test --workspace=backend -- --runInBand
npm run build
```

Builds and integration checks can require service configuration. If a check cannot run, state what blocked it. Documentation-only changes need link, command, and formatting review rather than a full application build. The backend lint command auto-fixes files, so review any resulting diff.

## Pull requests

Explain the problem and resulting behavior, link related issues, and keep unrelated refactors separate. Include screenshots for visible UI changes and reproduction steps for integration changes. Use your own test accounts; redact tokens, payloads, personal information, and customer data.

Do not commit `.env` files, service `config.json` files, API keys, OAuth secrets, database dumps, or generated build output. Never paste secrets into an issue, log excerpt, or screenshot.

## Reporting bugs and proposing features

Use the GitHub issue forms. For bugs, include reproduction steps, expected and actual behavior, environment, and sanitized logs. For features, explain the user problem and a concrete workflow that would benefit.

For suspected vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of filing a public issue.

## Community expectations

Be respectful, keep feedback specific and constructive, and protect other people's privacy. Maintainers may close abusive, off-topic, duplicate, or unreproducible reports and request a smaller scope before reviewing a change.
