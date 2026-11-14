# Noms visual identity — refresh 03

Noms is a white editorial canvas with vivid cooking features, crisp food photography, square geometry, Outfit headings and Manrope body text. The identity combines an independent food publication with a practical cooking app. No navigation destinations, content hierarchy, queries, permissions or persistence models are changed by this refresh.

## Shared tokens and files

`noms.tokens.json` is the platform-neutral source for colors, gradient stops, type roles, spacing, geometry, image treatments and interaction decisions. `scripts/design_tokens.rb` generates `design-tokens.css` from that JSON. Run `ruby scripts/design_tokens.rb` after editing tokens; `ruby scripts/build.rb` runs it automatically and includes the generated stylesheet and `identity.css` in `dist`.

The stylesheet order is `styles.css`, `atelier.css`, `design-tokens.css`, `identity.css`. The first two retain existing layouts and controls. `identity.css` is the shared presentation layer for this refresh; it consumes the generated variables. Do not add ad hoc color literals to page templates. Older styles remain in place for behavior/layout compatibility; this is not a complete rewrite of the legacy stylesheet.

The generator exports `--noms-*` color variables, `--noms-space-*`, type sizes and gradient definitions. Existing aliases (`--orchid`, `--pink`, `--citron`, `--burgundy`, `--ink`, `--line`) retain their brand meanings. Structural CSS rules still define component layout. The JSON also documents native touch targets and layering conventions that are not literal CSS output.

## Brand colors

| Role | Token | Value |
| --- | --- | --- |
| Pure white canvas | white | #FFFFFF |
| Text / important rules | ink | #000000 |
| Selected navigation and primary actions | lavender | #CAB7FB |
| Small frames and personal accents | pink | #F5CCE1 |
| Home meal planner | lime | #E5ED66 |
| Editorial labels, focus and cooking action | burgundy | #78182F |
| Quiet rules | divider | #E6E6E6 |
| Hover / empty photo surface | interactionTint | #F8F5FF |
| Small translucent surfaces | whiteVeil | #FFFFFFB8 |

Use black text on light feature surfaces, including the lime planner. White text is appropriate on the burgundy Start cooking action or black hover state. Burgundy is used sparingly for metadata and labels. Functional stock-status colors and user category colors retain their existing meanings. Disabled and placeholder text are distinct from primary readable text.

## Gradient features

Gradients are reserved for recipe heroes, Noms Pick, Discover search, the profile banner and recipe-editor heading. They are not applied to every card or working section.

All ramps are linear at 125° in CSS, with stops at 0%, 56%, 100%:

| Ramp | Start | Middle | End |
| --- | --- | --- | --- |
| Lavender recipe hero | #F5D8E9 | #E0CCFA | #EADDF8 |
| Pink recipe hero | #F9DDEB | #F0BFD9 | #EEDAF5 |
| Lime recipe hero | #F6F8D9 | #E5ED66 | #EEF3B1 |
| Noms Pick / profile wash | #F5D9EA | #D6C5FF | #F2D1DF |

A recipe's hero tone follows its existing stable `recipeColour()` result. This is presentation, not new recipe data or a recommendation algorithm. The entire top recipe section receives the ramp, containing photography, title, author, source, ratings, code, time, difficulty, servings and actions. Ingredients, directions and feedback stay white. The outer page remains white.

## Typography and spacing

Keep Outfit for headings and editorial numerals, Manrope for body and controls. Display headings use weight 500. Black is the default text color; burgundy is the label/accent ink.

- Page titles: up to 44 px; compact page titles 28–34 px.
- Recipe title: up to 52 px, compact 34 px, line height 1.03–1.05.
- Home planner title: 36 px / compact 32 px.
- Noms Pick title: 28–36 px, compact 30 px; clear priority above supporting text.
- Home gallery titles: 19 px / compact 17 px; wrap naturally.
- Section titles: 26 px; body 14 px / 1.5; direction text 14 px / 1.8.
- Metadata and labels: 10–12 px. Avoid widespread uppercase and spaced lettering. `NOMS PICK / 001` is a deliberate editorial index, not a ranking or an automatic weekly counter.
- Direction numerals: 28 px Outfit in burgundy, with no filled badge.

Use the documented spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 logical pixels. Main Home gap: 40 px desktop; recipe hero gap: 40 px. Compact feature padding: 16–24 px. Responsive geometry must wrap long titles and labels rather than force page overflow. Local calendar and inventory table scrollers remain valid within their own containers. Inventory search, tracking and sort fields use full-width rows at narrow widths so native selected-content does not overflow.

## Page treatments

| Area | Treatment |
| --- | --- |
| Home header | Burgundy date rule, stronger headline, existing copy/action |
| Three-day planner | Solid lime; black editorial label, larger dates, 7 px pink offset edge |
| Personal cookbook | Four photos in the existing grid; 4 px pink/lavender frame offsets, clear titles and times |
| Noms Pick | Existing divider and layered gradient feature; stronger image/title balance |
| Discover | Editorial heading and a gradient search strip; existing results/search behavior |
| Recipes / cookbooks | White card bodies, solid color edge, prominent photography; keep masonry/density choices |
| Meal Plan | White calendar columns, lime dates, burgundy today edge and photo-led planned meals |
| Inventory | Large counts with solid color edges, clear selection and quiet table headers |
| Profiles | One gradient banner, overlapping avatar, white identity and collection areas |
| Recipe create/edit | Gradient heading, larger name input, section labels with short rules, white working fields |

Page headings share an ink rule and a small colored section tab. Discover uses lavender, Recipes pink, Meal Plan lime, Inventory burgundy. These small accents identify the section without introducing new icons or decorative stickers.

## Photography, layering and fallbacks

Keep food images sharp and preserve their saved crop/zoom. The detail photo retains a square crop, with a 5 px white frame and an 8 px translucent white offset. Noms Pick has a 5 px white frame and a 7 px flat translucent offset, extending slightly beyond its desktop feature surface. Home gallery photos use a 1.5 ratio (1.4 compact) and small alternating pink/lavender offsets.

Use flat offsets, not blurred large shadows. Square frames and surfaces are mandatory; existing round avatars remain avatars. Do not blur food or put a glass layer across an entire feature. Translucency is limited to small metadata/code/action surfaces and frames, with no backdrop blur.

The existing neutral utensil fallback remains for missing covers. Home/detail cover load failures now replace the failed image with a readable neutral fallback, without modifying the recipe or its saved cover URL. Fallbacks preserve the surrounding link and allocated photo area.

## Buttons and interaction states

- Primary: lavender with black text; black with white text on hover.
- Cooking primary: burgundy with white text; black on hover.
- Secondary: white with ink text and a quiet border; stronger burgundy border on hover.
- Hero secondary: a small translucent white surface, with dark text and a burgundy-toned border.
- Text action: underline on hover; never rely on color alone.
- Selected navigation: lavender and a burgundy bottom rule, with no entrance animation.
- Gallery hover/focus: title underline plus a small `View recipe` label; no photo blur or movement.
- Focus: burgundy 2 px outline, usually 4 px offset. Preserve outlines, native disabled behavior, checkbox states and `aria-pressed` measurement controls.
- Web primary buttons and refined ingredient/measurement controls retain 44 px minimum targets. Use 48 logical units on native. Dense existing controls outside this scope are not a complete accessibility remediation.
- The recipe code remains a real copy button. The serving count in the hero mirrors the existing serving control; the calculation/persistence behavior is unchanged.
- Preserve loading/error/empty messages, retry actions, private-rating explanations and public-contribution opt-in. Do not use decorative labels to imply popularity or engagement.

## Expo translation

Use the JSON colors, type roles, spacing, ramp stops, image proportions and flat offsets as design decisions. Native line heights should be derived from font size and support accessibility scaling. CSS gradient angles and `object-position` are not native APIs; translate their visual intent using native image/layout and gradient primitives when the Expo project is planned. No Expo project or new runtime package is introduced here. See `react-native-readiness.md` for the code boundaries and unverified device work.

## Verification notes

The base feature stops and brand surfaces were checked with black body text and burgundy label text: the lowest calculated ratios were 11.68:1 and 5.93:1 respectively; white text on the burgundy action measured 10.66:1. These checks cover those color pairs, not a claim of full accessibility certification for every legacy control or state.

See `validation.md` for responsive/interaction coverage and known pre-existing test failures. Screenshots use isolated fixture images; production recipe covers and access permissions were not changed.

## Gradient expansion 04

The latest direction extends gradients beyond the hero. Home's planner now uses the lime ramp. Private ratings/notes use pink, while public comments use lavender; their input surfaces stay white and their existing privacy labels and contribution behavior are unchanged. Cookbook cards and their detail headings use the pink–lavender ramp. Shopping's Often bought panel uses lavender and its progress area uses lime. Inventory's In stock / Running low / Out of stock panels use distinct lime / lavender / pink ramps, with a burgundy outline for the selected filter. Profile footers use pink. Recipe card copy areas use a gentle gradient derived from their existing recipe color, preserving crisp photography and white gallery space.

This supersedes the earlier solid-planner, white-card-body and white-feedback prescriptions above. The page canvas, ingredients, directions and form inputs remain white. These are shared ramp applications, not new data categories or changes to status, ratings or recipe selection. `noms.tokens.json` records surface assignments and the adaptive card-gradient formula for future native implementation.
