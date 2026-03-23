# Storage Module

This storage module uses shared multi-tenant tables instead of creating one database or one table per user. That keeps migrations, connection management, indexing, and operational overhead predictable as workspace count grows.

User-defined records live in `documents.data_jsonb` so each workspace can store flexible JSON without schema churn. Stable Dominofy product data remains in normal relational tables, while workspace-owned arbitrary records get a JSONB-backed container with collection-level metadata in `collections`.

Tenant isolation is enforced in application code by deriving the effective workspace from the authenticated user and checking workspace membership before every query. `workspace_id` is always written by the backend, every read/write query filters by `workspace_id`, and document reads/updates also verify the parent collection belongs to the same workspace. There is an explicit TODO hook in the service layer for a future move to Postgres Row-Level Security once request-scoped DB session context exists.

If a workspace starts querying the same JSON field heavily, that field can be promoted later into a typed relational column or a dedicated index without changing the tenant model. The JSONB GIN index covers broad containment lookups, while high-frequency fields can be optimized incrementally when usage patterns are clear.
