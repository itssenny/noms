# Starter catalogue and recipe website import

This change uses the existing vanilla JavaScript SPA and Supabase schema. It does not introduce Next.js, another database, a system Auth account, or an AI provider.

## Rollout

1. In staging, apply the existing migrations through 019, then `020_recipe_catalog.sql` and `021_starter_recipes.sql` in order using an operator/database-owner connection. Both new files use transactions and can be rerun. They retain existing recipes, ingredient IDs, profile privacy, covers and personal feedback.
2. Deploy `supabase/functions/recipe-import` and its `_shared` imports with the Supabase CLI: `supabase functions deploy recipe-import --project-ref YOUR_PROJECT_REF`. The repository's `supabase/config.toml` disables the gateway JWT check for this function only; the handler calls Auth's `getUser(token)` before fetching any website. Never remove this handler authentication. Default `SUPABASE_URL` and legacy `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEYS` supply configuration; no service-role key or AI key is used.
3. Run `npm run build` and deploy the resulting frontend together with the migration/function rollout. The build includes the browser-safe import helper and SQL files. Edge Function sources are deployed separately by the CLI, not served as executable frontend endpoints.
4. Verify the staging lifecycle below with two signed-in accounts, then use the same rollout order for production. The local implementation and tests do not apply migrations or deploy functions to a hosted project.

Supabase references: [function configuration](https://supabase.com/docs/guides/functions/function-configuration), [auth headers](https://supabase.com/docs/guides/functions/auth-headers), [function secrets](https://supabase.com/docs/guides/functions/secrets).

## Expected behaviour

- Discover starts with Miso chickpea crunch bowls, Creamy gochujang pasta, and Green goddess chickpea toast, plus recipes whose author profile and recipe are both public. It is available inside the signed-in shell, with search and pages of 24 recipes.
- Starters reuse shared catalogue ingredients, are read-only to app users, and can be bookmarked in Saved. They do not increase Created counts or copy records into each account.
- Imported recipes start private in the review editor. Confirm every ingredient and any missing servings/time, edit as needed, then save to Created recipes. Importing alone writes no recipe or ingredient rows.
- Private drafts have no code. First publication assigns an immutable six-character code; changing back to private retains the code but prevents visitor lookup. A private creator profile still hides its public recipes. UUID links continue to work.
- The three starter recipes are original text with all recipe ingredients listed; water used for cooking/loosening sauces is not a stock-tracked ingredient. No external covers are downloaded.

## Verification

Run the Node regression suite with PGlite available:

```sh
PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test tests/*.test.mjs
```

The new migration test exercises PostgreSQL RLS, safe reruns, stable ingredient identity, code lifecycle, starter ownership and masked projections. Import tests cover JSON-LD graphs/arrays, nested instructions, malformed blocks, multiple recipes, durations, uncertain quantities, blocked URLs/IPs, redirects and HTTP response limits/decoding.

For the function, run `deno check supabase/functions/recipe-import/index.ts` and `deno test --allow-env --allow-net tests/recipe-import-edge.test.ts` with Deno and its Node type definitions available. The handler test stubs Auth and checks anonymous/invalid-user denial, URL rejection and request size bounds; it opens no server and contacts no Supabase project. The development check used an isolated temporary Deno config with nodeModulesDir=auto, keeping dependencies out of the application repository.

The existing `tests/privacy-browser.cjs` and new `tests/recipe-catalog-browser.cjs` run against a local server with a mocked Supabase module, never the hosted database. Set PLAYWRIGHT_MODULE, FOODHUB_URL and optionally BROWSER_EXECUTABLE/SCREENSHOT_DIR. Browser coverage includes default privacy, Created/Saved separation, starter details, code search, import review, unresolved ingredient blocking, editing and saving, and readable errors. Desktop/mobile screenshots accompany the new fixture run.

Staging checks: confirm anonymous function requests return 401 before outbound fetching; import a real accessible website recipe and review/save it; cancel an import and change accounts during a delayed request; publish/re-privatize the result and test code lookup from the second account; make its author profile private; bookmark a starter and plan/cook from Saved; confirm private ratings/notes remain inaccessible. Supabase-hosted Edge Runtime and storage integration still require this staging check.

## Phase-one limits

Only complete JSON-LD Recipe data is supported. Sites requiring login, JavaScript execution, bot challenges or non-identity content encoding may refuse import. The fetcher uses public IPv4 HTTPS with a 12-second deadline, up to four fetched pages including redirects, 32 KiB headers, 3 MiB wire data and 2 MiB decoded HTML. IPv6-only sites are unsupported. Website protections are respected; there is no bypass or video/social scraping.

Ingredient parsing deliberately leaves ranges, ambiguous units, package sizes and informal amounts for review. Exact visible catalogue matches can be preselected; other names use the existing picker, or the explicit Add missing ingredients & save recipe confirmation. Required fields and duplicate/incomplete rows are validated before writes. Imports do not infer missing servings, timings or quantities. Personal feedback for Saved recipes retains the existing owner-only behaviour. Existing recipe creation still uses multiple requests and compensating cleanup rather than a new atomic transaction.

The first version has no persistent per-user import quota; apply project/gateway rate limiting appropriate to the deployment before broad public rollout. Authentication, response/time bounds and safe egress are enforced in code. The catalogue remains small and searchable; future editorial tooling and social imports are separate work.
