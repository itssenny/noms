# Mise & Meal architecture

- Frontend: responsive vanilla JavaScript SPA. `app.js` renders product surfaces; `ingredients.js` owns catalogue search, selection, and shared unit options.
- Backend and authentication: Supabase PostgreSQL and Supabase Auth through `supabase-client.js`. Browser configuration uses a publishable key, never a service-role key. The Ruby build supports public configuration from environment variables or `supabase-config.local.js`.
- Source of truth: `db/supabase/001` through `005`. `db/schema.sql` is a legacy SQLite/D1 design and is not used by the current browser persistence layer. Existing hosting D1 metadata is retained, not migrated.
- Shared catalogue: `ingredients.id` is referenced by `inventory.ingredient_id` and `recipe_ingredients.ingredient_id`. Authenticated users can read catalogue records; privileged administration maintains them. Names are presentation data; IDs are persisted identity.
- Inventory: one record per user and ingredient. RLS restricts all operations to its owner. Quantity, entered unit, storage location, threshold, expiry and notes belong to inventory. Default units belong to the catalogue and are suggestions only.
- Recipes: owned through `recipes.user_id`; recipe ingredient RLS checks parent ownership. Recipe creation is currently multiple requests with compensating deletion on failure, not an atomic database transaction. Uploaded covers may remain orphaned after failure.
- Units: entered units are preserved. No conversion is performed. Exact quantities remain the existing UI model; ingredient identity is independent of quantities and supports a later nullable-quantity/status migration.
- Legacy limitations: display state and existing matching/deduction logic still use name-keyed inventory and assume comparable quantities. These existing features were not extended; proper ID-based matching and unit validation are a separate task. Planner/shopping state is in localStorage and is not user-scoped. Recipes/inventory are stored in Supabase under RLS.

See `db/CANONICAL_INGREDIENTS.md` for rollout, data review and validation.
