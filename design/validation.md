# Visual refresh validation

## Passed

- Build: `ruby scripts/build.rb`; JavaScript syntax and Ruby token-generator syntax; `git diff --check`.
- Shared variables are generated from the JSON token source. `identity.css` contains no direct hex color literals.
- Supabase `from()` / `rpc()` call signatures match the source captured before the visual refresh. No schema, RLS, route or backend changes were made.
- App-wide local browser fixture checks at 1440, 768, 375 and 320 px: Home structure, Discover, Recipes, distinct pink/lime/lavender recipe heroes, Meal Plan slot mode, Inventory filters/search, profile/editor, creation, missing-image fallback and no whole-page horizontal overflow.
- Focused detail fixture checks at those widths: source link, metadata, square image, unchanged crop behavior, serving scaling, metric/US conversion, ingredient presence updates, editing/private visibility, cooking, saving, copying a public recipe code and returning to Home. Ingredients/directions remain white below the hero.
- Existing community-rating suite: private default, opt-in/out, updates, clearing, Saved personal ratings and compact layout.
- Existing cooking-navigation suite: step actions, keyboard navigation, scroll preservation and interaction guards.
- Existing density suite: all three recipe sizes, stable card nodes, menu bounds and preference persistence at desktop/mobile.
- Existing card-action suite: Save/Unsave, Saved-page removal, meal planning and Safari-style focus loss at desktop/mobile.
- Color-pair calculations: black on feature stops/brand surfaces >= 11.68:1; burgundy labels >= 5.93:1; white on burgundy 10.66:1. This is a targeted color check, not a full accessibility audit of the legacy app.

## Known failures present before this refresh

The full Node/PGlite run reports 187 tests: 185 pass and two fail. Both were previously reproduced against the earlier checkpoint:

1. `tests/planning-model.test.mjs`: the coverage assertion for incompatible units / different ingredient IDs returns a nonzero value.
2. `tests/recipe-availability.test.mjs`: an isolated `card()` harness does not provide `recipeCardActions`.

`tests/managed-profiles-browser.cjs` also fails a DOM-count assertion expecting three `[data-edit-recipe]` elements inside the profile view. It finds zero. The same failure was reproduced by serving the pre-refresh application, markup and stylesheet snapshots through the fixture runner. It is not hidden by changing the expectation in this task; the current profile collection UI opens recipes through its existing links, while detail editing remains available to owners/managers.

## Limits

Browser runs use isolated mock Supabase clients and fixture images. They do not write production data or prove deployed authentication/storage/RLS integration. Native/Expo rendering, device accessibility scaling and native upload/auth flows remain future migration work. The changes are local; this task does not commit, push or deploy them.


## Gradient expansion 04

Expanded the shared gradient ramps to the Home planner, personal recipe feedback, public comments, cookbook cards and headings, Often bought, shopping progress, three inventory stock filters, recipe card bodies and profile footer. White inputs and reading surfaces remain clear.

The identity and detail browser suites pass at 1440, 768, 375 and 320 pixels, including gradient assertions, stock-filter distinction, shopping-panel coverage, recipe interactions and overflow checks. Mobile Home and shopping screenshots were visually inspected.

The cookbook browser suite completed creation, card navigation, editing, visibility, mobile layout and recipe picker checks before failing its action-order assertion at line 74: the detail action list includes the existing Made it button before Plan. Gradient expansion changes no action markup or ordering. This legacy expectation remains unresolved.
