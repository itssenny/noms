# React Native readiness

This is a code inspection report, not a migration or a claim of native runtime compatibility. The target described by the user is React Native with Expo; no Expo project or runtime dependency is introduced here. The current application uses browser JavaScript modules and HTML templates, not React. `package.json` has no React runtime or bundler dependencies. A React Native application will need a new presentation layer; creating that project is outside this task.

## Reuse candidates

| Code | Reuse boundary |
| --- | --- |
| `cooking.mjs` | Quantity conversion, stock availability, serving scaling, substitutions and deduction calculations. Pure functions accept data and return data. |
| `planning.mjs`, `calendar.mjs` | Local calendar dates, plan movement, source tracking and shopping coverage. Retain local-date semantics and test device time zones / daylight saving. |
| `measurements.mjs` | Unit parsing, verified-density conversion and formatting. Inject a storage adapter for preference helpers; confirm the target runtime supports the required `Intl` behavior. |
| `stock-model.mjs`, `feedback.mjs`, `recipe-tags.mjs`, `gallery.mjs` | Validation, stock classifications, feedback patches, tags and deterministic cooking-history shelves. |
| `list-models.mjs` | Recipe/inventory filtering and sorting. Move mutable category-color overrides into app-scoped state before sharing between screens. |
| `crop-geometry.mjs`, part of `cover-framing.mjs` | Normalized coordinates and crop/drag calculations. `framingStyle()` returns CSS and must be replaced with a native image framing adapter. |
| `account-state.mjs`, `shopping-extra.mjs` | Models and transformations can be reused. Current persistence expects synchronous Web Storage; separate persistence from transformations for an asynchronous native store. |
| `supabase/functions/_shared/recipe-import.mjs` | Pure extraction/normalization is a candidate for shared tests. Keep remote website fetching and privileged server operations on the backend. |

Existing unit tests for these functions are useful behavioral contracts. Add native-runtime checks rather than assuming Node success proves device compatibility.

## Supabase

`supabase-client.js` imports Supabase JS 2.57.4 through an esm.sh URL and reads configuration from `window`. Replace that bootstrap with a packaged dependency and native configuration. The existing query shapes and RPC contracts can be retained, including saved/visible recipe reads, recipe feedback and inventory ownership checks.

Native authentication needs a supported persistence adapter, application foreground/background handling and callback/deep-link routing. Browser URL-session detection alone is insufficient. Revalidate session/profile changes while a request is in flight; retain the current session/request-version guards. Do not add privileged credentials to the client.

Keep existing Supabase RLS policies and server authorization. Do not copy recipes into an unrestricted global cache. Private recipe visibility and unavailable saved recipes must retain their current meaning.

Cover download/upload currently uses browser Blob objects, object URLs and browser file inputs. Native needs image-picker/file access and an upload/download adapter, including revocation/cache cleanup equivalents and storage authorization. Verify on real devices and against the deployed backend during migration.

## Web presentation to rewrite

- `app.js` mixes HTML template rendering, DOM queries, delegated browser events, view routing, Supabase operations and shared mutable state. The Home and detail templates cannot be reused as native UI components.
- `auth.js`, `profile.js`, `cookbooks.js`, `catalogue.js`, `ingredients.js`, `cover-editor.js` and `ui.js` contain DOM-specific presentation or interaction code, sometimes alongside reusable data operations.
- CSS grid, columns, pseudo-elements, shadows, gradients, hover, `:focus-visible` and CSS image transforms need native equivalents. Translate the design intent in `noms.tokens.json`, not CSS strings.
- Cache-busting query strings in module imports, hash routes, History API, browser dialogs, HTML forms, native web selects, drag/drop, clipboard calls, focus management, file inputs, canvas cropping and object URLs need native routing and platform services.
- Icon SVG markup from `ui.js` needs a native renderer. Outfit/Manrope should be bundled or loaded with the native font mechanism instead of Google Fonts `<link>` tags.

## Dependency and tooling observations

The application uses a browser-hosted Supabase import, Google Fonts and browser APIs, rather than a large npm UI dependency graph. Those delivery mechanisms do not transfer directly. Ruby/WEBrick and `scripts/build.rb` serve and package the web app; GitHub Pages deployment remains web-only. Node browser tests, Playwright and PGlite are development tools, not native application dependencies.

No new native package is selected or installed by this exploration. Package choices and target-version compatibility should be verified when a native project is actually planned.

## Suggested separation, in order

1. Define canonical recipe/plan/inventory data models. Move `mapRecipe()` normalization out of `app.js`; separate category updates from mapping and transient display fields such as Blob URLs from persisted recipe data.
2. Extract repository functions for recipe libraries, public selection, inventory and feedback. Inject the Supabase client and preserve server-side authorization and stale-request protection.
3. Keep existing pure calculations as shared modules with their behavioral tests. Do not duplicate quantity or measurement logic inside components.
4. Introduce storage, image, navigation and clipboard adapters. Plans and shopping lists currently live in account-keyed local storage, so a new device will not automatically inherit them. Decide local-only versus synchronization requirements separately; do not silently change persistence during a visual task.
5. Build native screens around those models and services using the documented tokens. Validate Home and one representative recipe first, including long content, dynamic text sizes, screen reader order and touch targets.

## Limits and verification

This task does not change schemas, RLS, persistence or business logic, and does not create a React Native project. Native authentication, uploads, gradients, font rendering, accessibility and device performance remain unverified. The JSON design tokens now generate the shared web token stylesheet through `scripts/design_tokens.rb`, called by the normal Ruby build. `identity.css` supplies shared component presentation. The same JSON can be read by a future Expo application, but native components, font loading, gradient geometry and platform services still require implementation; this generator is not a native component library.
