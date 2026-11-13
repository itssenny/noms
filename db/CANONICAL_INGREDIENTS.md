# Canonical ingredient rollout

Current catalogue management: apply migration 007 before using inline creation or Inventory → Manage ingredients. It includes the 004 foundation if missing; do not run 004 after 007. For an empty catalogue, run 005 immediately after 007, before adding custom ingredients. Shared starter entries are read-only; users can create/edit their own entries. Earlier descriptions of a fully read-only catalogue below describe the pre-007 release.


Apply migrations in order in the development Supabase project, before deploying this frontend:

1. Existing `001_core_recipe_inventory.sql`, `002_profiles.sql`, `003_recipe_manual_entry.sql` (do not reapply if already installed).
2. `004_canonical_ingredient_foundation.sql` adds default units and a generated whitespace/case-normalized name with a unique index, and removes ordinary-user catalogue writes. Existing inventory/recipe owner RLS is untouched.
3. `005_development_ingredient_catalogue.sql` optionally seeds 40 common development ingredients, reusing existing names and known plurals. It can be rerun.

No tables, users, recipes or inventory records are deleted. All existing foreign keys already reference ingredients; no text-reference backfill is required. Unrecognized ingredients receive `piece` as an editable fallback default. The seed assigns known defaults without modifying existing inventory or recipe units, and preserves existing categories/labels. Privileged administrators should review defaults for ingredients outside the starter set.

Before 004, review potential normalized collisions:

```sql
select lower(regexp_replace(trim(canonical_name), '[[:space:]]+', ' ', 'g')) as normalized,
       array_agg(id) as ids, array_agg(canonical_name) as names
from public.ingredients group by 1 having count(*) > 1;
```

If collisions exist, 004 rolls back. Resolve them deliberately before retrying; do not sum different units or discard conflicting recipe rows. Existing plural/singular pairs remain separate if both already exist. The seed avoids adding a singular when its known plural exists, preserving that existing ID and label. Unknown historical plurals are not guessed or merged. Case-insensitive substring search finds `cucumbers` from `cuc`; this is not fuzzy spelling correction or synonym search. Restricting all catalogue writes from ordinary users prevents new arbitrary plurals. Privileged imports must curate singular/plural concepts themselves; normalized uniqueness only guarantees case/whitespace uniqueness.

Relationships:

- `auth.users.id → inventory.user_id`, `recipes.user_id`
- `ingredients.id → inventory.ingredient_id`, `recipe_ingredients.ingredient_id`
- `recipes.id → recipe_ingredients.recipe_id`

The catalogue keeps existing category labels and aliases JSON for future extension. No aliases/equivalence engine is added. The app searches Supabase on demand (150ms debounce, at most 10 results), stores the selected record separately from typed text, ignores stale responses and supports keyboard or pointer selection. Selecting again resets the suggested unit; editing other fields does not. Saving an existing inventory ingredient retains the existing upsert behavior: quantity/unit/location/threshold replace those fields, rather than adding quantities.

## Validation

Local: `node --test tests/ingredients.test.mjs`; `npm run build`; JavaScript syntax checks. SQL integration test: install `@electric-sql/pglite` in a temporary directory, then run `PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node --test tests/ingredient-migrations.test.mjs`.

Live acceptance (requires applied migrations and authenticated development sessions):

- Log in as existing user A; existing recipes/inventory load.
- Search `cuc`, `CUC`, `tom`; choose a result, and verify unselected/edited text cannot save.
- Cucumber defaults to piece, Flour to g, Milk to ml; override a default and save.
- Reload and confirm the saved name, quantity and chosen unit; inspect ingredient_id in Supabase.
- Sign in as B: A's inventory is invisible; attempting updates to A's row must affect zero rows or fail RLS.
- An authenticated client cannot insert/update/delete catalogue records. A privileged duplicate case/whitespace insert must fail the unique index.
- Add a recipe using catalogue selections and load it again. Duplicate ingredient rows show a validation error before any recipe is created.
- On desktop and a narrow mobile viewport, verify suggestions, keyboard arrows/Enter/Escape, scrolling and no console errors.

Verified locally: all three picker tests and both isolated PostgreSQL integration tests pass, as do the production build, JavaScript syntax checks and diff whitespace checks. The SQL harness supplies mock Auth roles/users and omits only the pgcrypto extension declaration (the test runtime already provides UUID generation); it runs the actual core and new migration SQL. This does not inspect the deployed database.

Live checks and publication remain pending until database access/migration application and a browser session are available. Do not interpret mocked client tests as proof of live authentication, persistence or RLS.

## Editable catalogue acceptance

- With 007 applied, open Inventory → Manage ingredients. Shared starter records and your custom records appear; only your custom records have Edit.
- Add a unique ingredient with category/default unit; edit its name and default unit, reload, and verify persistence and stable ID. Existing saved recipe/inventory units must remain unchanged.
- While adding a recipe, type an unknown name, choose Add ingredient to catalogue, fill the inline fields, then Add and select. The recipe form stays open and receives a valid ingredient ID.
- Searching an existing name and adding the same spelling/case must reuse the visible record. A different account cannot see/edit private entries or reference their IDs in recipe/inventory writes.
- If default_unit or created_by is missing, show a migration error rather than a no-results message. Live database and browser checks remain required.
