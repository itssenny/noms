# Cookbooks rollout

Cookbooks live under My Recipes alongside Created and Saved, and on profiles in the tabs Created recipes · What I made · Cookbooks. Collections belong to the signed-in account’s personal profile, consistently with Saved Recipes. Existing imports remain Created recipes.

## Deploy

1. Apply existing migrations through 032.
2. Apply `033_personal_cookbooks.sql` if not already applied, then `034_public_cookbooks.sql` once using the existing SQL migration process.
3. Run `npm run build` and deploy `dist/` through the existing hosting workflow.
4. Use two staging accounts to verify owner management, public/private switching, profile tabs, direct Cookbook URLs, author links, and authenticated cover downloads.

These migrations were tested locally and have not been applied to production. No additional environment variables are needed. The editor’s visibility control requires migration 034.

## Personal experience

- Create, rename, describe and delete collections. Set private/public in the editor and choose a cover from member recipes, with automatic fallback.
- Add recipes within a Cookbook through a searchable picker for Created/Saved or paginated Discover. Multiple recipes can be selected across searches. Discover recipes are saved before their IDs are added; originals are never copied.
- Recipe detail actions are ordered Start cooking, Add to meal plan, Add ingredients to shopping list, Add to Cookbook, then the Save bookmark for other users’ recipes. The Cookbook selector supports multiple collections per recipe.
- Recipe cards inside a Cookbook omit the redundant Add to Cookbook action. Open the recipe detail to manage its memberships in multiple Cookbooks.
- Cookbook cards and headings show recipe count · author, with a profile link. Profile Cookbooks open the same detail view; visitor views omit all collection mutation controls.
- What I made uses existing recorded cooking history for the owner’s created recipes. It is private; visitor profiles do not expose personal cooking history or notes. Creating a new history model for recipes cooked from other authors is outside this change.

## Privacy and access

Migration 034 allows owner-only public/private writes while leaving the base Cookbook and junction tables owner-only. Authenticated visitor reads go through explicit security-definer projections with a locked search path. Internal helpers are not client-callable.

A visitor may read a Cookbook only when its visibility is public and its author’s personal profile is public. Profile privacy continues to override collection publication. Signing in is required, consistently with existing public recipes; anonymous shared access is not implemented.

For nonowners, only member recipes whose recipe and creator profile are public (or public catalogue recipes) appear. Private member IDs, titles, ingredients, cover references and counts are excluded. This remains true even when the viewer manages a private member recipe. Recipe and author profile privacy are rechecked on each read; publication never changes recipe ownership or privacy. A public collection may contain private recipes for its owner, but visitors see only its public subset.

Owner views retain generic unavailable entries with a remove action. Public views omit inaccessible entries entirely. Private collections and public collections on private profiles are inaccessible to other accounts. Only an owner can change memberships, visibility, metadata or delete a collection.

The composite membership primary key prevents duplicates. Removing a member or deleting a Cookbook cannot delete original recipes. Deleting a recipe removes memberships and clears its cover reference. Recipe updates are reflected through live references. Removed/inaccessible cover members are ignored by the cover projection.

Multiselect writes are sequential. If a network write fails partway through, successful earlier writes remain saved; the error is shown and retrying is safe. Account/profile changes invalidate pending loads and close collection dialogs.

## Verification

`tests/cookbooks.test.mjs` and `tests/public-cookbooks.test.mjs` apply the complete migration chain in PGlite. They check ownership, visibility changes, duplicate prevention, cross-collection edits, Saved eligibility, privacy changes, safe covers/counts, deletion, public projections and anonymous denial.

```sh
PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node --test tests/*.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright node tests/cookbooks-browser.cjs
```

The browser fixture never contacts production. It tests CRUD, direct addition/search, multiple memberships, visibility toggles, author links, profile tabs, read-only public views, action order and desktop/mobile layout. Live Supabase/storage/CDN and deployment checks remain for staging.

The full suite has an unrelated existing failure in `tests/planning-model.test.mjs`: it treats cups as incompatible with millilitres while the existing measurement implementation converts them.

## Remaining scope

Followers, likes, collaboration, saving/following other users’ collections, public Cookbook discovery and anonymous sharing remain unimplemented. Collections have no application count limit; their summaries currently load together, so very large libraries may eventually benefit from pagination.
