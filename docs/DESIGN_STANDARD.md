# Kappa Web — Design Standard (Astryx-neutral + Kappa green)

Single standard for all `apps/web` pages. Match Meta Astryx; keep Kappa brand green.

## 1. Foundation (no exceptions)

- `@astryxdesign/core` + `@astryxdesign/theme-neutral`, forced `mode="light"`, `data-astryx-theme="neutral"`.
- `apps/web/src/styles.css` import order: `reset.css` → `astryx.css` → `theme.css`. No other global CSS.
- `apps/web/src/theme.stylex.ts` is the token source; the only other hex lives in the
  brand-override block in `styles.css` (`html[data-astryx-theme='neutral']`). No hex elsewhere.
- Tokens mirror Astryx-neutral **light** values, except accent/brand/focus which are Kappa green:
  - `bg #F1F4F7` (= `--color-background-body`), `surface #FFFFFF` (= `--color-background-surface`)
  - `surfaceSunken rgba(5,54,89,0.05)` (= `--color-background-muted`), `ink #0A1317` (= `--color-text-primary`)
  - `muted #4E606F` (= `--color-text-secondary`), `line rgba(5,54,89,0.10)` (= `--color-border`)
  - `lineStrong #CCD3DB` (= `--color-border-emphasized`)
  - `accent/brand/focus #3f6b55` (Kappa green override, NOT Astryx `#0064E0`), `accentHover/brandHover #365b48`
  - Applied twice: StyleX tokens (custom surfaces) AND `styles.css` unlayered
    `html[data-astryx-theme='neutral']` override (`--color-accent`, `--color-text-accent`,
    `--color-icon-accent`, `--color-accent-muted`, `--color-on-accent`, `--focus-outline-color`)
    so Astryx primary buttons/focus match StyleX brand. Neutral's own accent is near-black
    (`#1b1b1b`), not blue.
  - `accentInk #FFFFFF`, `accentSoft #EAF0EC` (green wash), `danger #E3193B`, `dangerHover #AA071E`
  - `success #0D8626`, radius `6/10/14`, fonts system sans + mono.
- No gradients, no glow, no glass. No decorative motion.

## 2. Components — Astryx first

- Primitives via `apps/web/src/components/ui.tsx` wrappers only: `Button`, `TextInput`, `Select`, `ErrorNote`, `InfoNote`, `QueryError`, `Badge`, `StatusDot`, `Tabs`.
- Page chrome via Astryx directly: `Layout`/`LayoutContent`/`LayoutHeader`, `Text`/`Heading`, `Card`, `Section`, `Grid`, `VStack`/`HStack`/`StackItem`, `Divider`, `EmptyState`, `Banner`.
- No raw `<button>`, `<input>`, `<select>`, or hand-rolled table chrome outside `ui.tsx` / shared tables.
- `CvPanel`, `JobsTable`, `SubscriptionsTable` are the only shared complex blocks. Pages compose them; they don't re-implement them.

## 3. Page patterns (template source)

| Route | Astryx template | Shape |
|---|---|---|
| `/` | `centered-hero` + `library` | Display-2 hero + primary/secondary CTAs, `library` Card Grid for sample matches, muted Card for Discord delivery, 3-step how-it-works |
| `/dashboard` | `library` Card Grid | `Heading level=1` + search + `Grid minWidth 260` of `ClickableCard` (DM + servers), `EmptyState` when none |
| `/dashboard/dm`, `/dashboard/servers/$guildId` | `table-page` Searchable Table | Back link + `Heading 1` + `Tabs Jobs\|Manage`; Jobs = filter row + table + pager; Manage = `Card` sections |
| `/dashboard/settings` | `settings-sidebar` Settings Panels | `Heading 1` + sub; `Card` Account summary (`MetadataList`-style dl); `Card variant=muted` danger zone with confirm phrase |
| `/auth/error` | `EmptyState` in `Card` | Centered `Heading 1` + `Text secondary` + primary/secondary actions |

Chrome (`__root.tsx`): `shell-top-nav` — 58px topbar, content `maxWidth 960`, footer with product line. `TopNav` uses `ui.Button` + router `Link`.

## 4. Proof

- `bun --filter @kappa/web typecheck` + `bun --filter @kappa/web build` green.
- No `src/prototypes/`, no `src/routes/prototypes/` (removed 2026-09-28).
- Deleting any wrapper, token, or pattern above breaks at least one route — that is the necessity test.
