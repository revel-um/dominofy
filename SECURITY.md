# Security reporting

Do not report suspected vulnerabilities, exposed credentials, or private workflow data in public issues or pull requests.

Use [GitHub private vulnerability reporting](https://github.com/revel-um/dominofy/security/advisories/new) if it is enabled. If that page is unavailable, request a private reporting channel from the maintainers without disclosing exploit details or sensitive data publicly.

Include the affected commit, impact, reproduction steps, and a minimal sanitized example. Do not access other users' data to demonstrate a vulnerability. If a credential has been exposed, its owner should revoke or rotate it immediately; deleting the visible file does not remove it from Git history.

The project does not currently publish a supported-version matrix, security response SLA, or production hardening guarantee. Use isolated development data when evaluating the application.
