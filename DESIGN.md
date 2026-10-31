---
name: Kappa
description: Restrained green web design system for the homepage and application.
colors:
  discord: "#5865f2"
  discord-hover: "#4752c4"
  discord-active: "#3c45a5"
  accent: "#3f6b55"
  accent-hover: "#315541"
  accent-soft: "#e3eee5"
  leaf: "#eaf1e9"
  ink: "#22372a"
  ink-2: "#45564a"
  muted: "#607064"
  paper: "#fafbf9"
  paper-2: "#f2f5f1"
  paper-3: "#e5ebe3"
  surface: "#ffffff"
  rule: "#dae2d8"
  input-edge: "#849680"
  chat: "#27272b"
  chat-2: "#232428"
  chat-3: "#34353c"
  chat-ink: "#f2f3f5"
  chat-muted: "#b9bbc5"
  chat-rule: "#45464e"
  chat-link: "#67afff"
  chat-brand: "#86a9b7"
  chat-focus: "#c5dbc8"
typography:
  app-heading:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  display:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "clamp(3.25rem, 6.2vw, 5.25rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "clamp(2rem, 3.2vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.12
  body:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  lead:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.6
  supporting:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.55
  metadata:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "Onest, ui-sans-serif, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  small: "6px"
  control: "8px"
  panel: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  columns: "28px"
  stack: "32px"
  wide: "64px"
  section: "80px"
  section-mobile: "48px"
components:
  button-discord:
    backgroundColor: "{colors.discord}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 24px"
  button-discord-hover:
    backgroundColor: "{colors.discord-hover}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
  nav-main:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "22px 0"
  chip-source:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.small}"
    padding: "4px 8px"
  preview-discord:
    backgroundColor: "{colors.chat}"
    textColor: "{colors.chat-ink}"
    rounded: "{rounded.panel}"
  preview-dashboard:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
---

# Design System: Kappa

## Overview

**Creative North Star: "Green Community Programme"**

A restrained version of the established green world: near-white reading fields, muted green actions and emphasis, and Onest typography. The user requested minimalist color for a job-finding tool. Brand personality comes from the supplied mascot rather than large saturated fields.

The standard now covers the homepage and all remaining web pages: dashboard, personal/server job pages, CV/subscription management, settings and auth error. Shared palette and typography live in `apps/web/src/tokens.css`, `styles.css` and `fonts.css`; homepage-specific composition and Discord demonstration colors remain local. Working pages use the same world with restrained fixed-size headings and task-first density, rather than the homepage's display scale.

**Key Characteristics:**

- Near-white fields with muted green emphasis.
- Supplied mascot, not a recreated or recolored logo.
- Flat tonal panels, thin dividers and gently rounded controls.
- A static content-rich Discord conversation and working dashboard previews.

Source of truth: shared `tokens.css`, `styles.css`, `fonts.css` and `components/ui.tsx`, plus `landing-soft.css`, `product-showcase.tsx` and `kappa-mark.tsx` for surface-specific treatments. Styling is compiled by Tailwind CSS v4: existing CSS variables are exposed through `@theme inline`, shared and route-local recipes use `@apply` in the components layer, and the original base rules are retained instead of introducing a new reset. Route styles declare the shared layer order so direct loads and client navigation render consistently. PRODUCT.md records brand commitments; surface briefs own route composition.

## Colors

Exact values are in the frontmatter. The accent matches the supplied logo's background; the yellow remains part of the mascot, not a separate interface accent. Discord Blurple is reserved for sign-in actions with the official unmodified white Discord symbol. The rest of the page keeps Kappa's green identity.

### Primary

- **Muted green:** actions, headline emphasis, free-offering emphasis and light-surface focus.
- **Accent-soft:** selected tabs and active subscription statuses.
- **Leaf:** the quiet reply button against dark chat.

### Neutral

- **Ink / ink-2 / muted:** headings, supporting copy and metadata.
- **Paper / paper-2 / surface:** near-white main fields, softly tinted FAQ and white dashboard preview.
- **Rule / input-edge:** quiet separators and stronger input outlines.
- **Chat variants:** Discord's neutral dark message/embed surfaces, blue job titles and muted bot author color follow the supplied real-app screenshot. They are demonstration-specific, not an alternate theme for the application.

Selection reverses ink and paper on light surfaces. Within Discord, selection uses chat-focus on chat-2 and the caret uses chat-ink. Large hero and pricing fields remain near-white.

## Typography

Onest is globally self-hosted through `apps/web/src/fonts.css` from `assets/fonts/onest-latin-variable.woff2`, normal variable weights 400–800 with swap loading. Headings and wordmarks use tight tracking; numbered demo jobs use tabular numerals.

Application headings are fixed 2rem, reducing to 1.75rem at 40rem; field/body text is 1rem and section titles 1.25rem. Fluid display type belongs only to the homepage. Shared header wordmark is 28px/700 with -0.035em tracking. Nav links are 14px, footer wordmark 22px and preview 20px. Plan headings use the existing 32px section-size step with a 13px medium-weight inline availability status. Pricing uses two flat columns with thin top rules, stacking on mobile; there are no nested plan cards or unavailable purchase actions.

At max-width 40rem, hero display is `clamp(2.625rem, 11vw, 4.25rem)`, section headings 32px, hero support 16px, nav links 12px, primary actions 13px. These are existing route-specific adjustments, not a global type scale.

## Layout

Centered container: `width: min(100%, 1344px)` with fluid horizontal padding `clamp(24px, 4.5vw, 64px)`. Sections use 80px vertical padding, reduced to 48px on mobile. Preview columns have a 28px gap; shared control/content spacing remains tight.

Application dashboard content uses a persistent 256px softly tinted sidebar and a near-white work area with an 1180px maximum width, 40px desktop side padding and 48px top padding. Below 60rem the sidebar becomes a native dialog navigation drawer, opened from a compact header; content uses 24px side padding, reducing to 16px at 40rem. The drawer is scroll-contained, locks background scrolling while open, closes on navigation/Escape/backdrop and returns focus to its trigger. CV/create and account panels form two desktop columns and stack at 60rem. Tables preserve column semantics and render labeled rows below 40rem, with wrapped actions. Native dialogs have 32px desktop/20px mobile padding and escape containing frames. Auth error keeps the centered non-dashboard shell. Page-specific layouts remain in route briefs.

At max-width 60rem, homepage hero support and preview frames stack, the mascot becomes a 64px mark above the headline, and frame minimum heights become automatic. At max-width 40rem, FAQ/pricing columns stack and preview side padding reduces to 16px. Coarse-pointer shared controls use 48px minimum height.

## Elevation & Depth

No box shadows or faux texture. Tone, thin borders and actual product-demo content establish depth. Light focus is a 2px accent outline with 3px offset; dark chat uses chat-focus. The search input uses an inward offset of -3px.

The homepage mascot gives one 700ms greeting tilt on arrival, using transform only and the shared `--ease-out`; the duration follows the generated theme's slow step. It settles upright with no loop or hover replay. Navigation marks, Discord avatars and task pages stay still. Reduced motion keeps the mascot static and disables transitions. Touch hover overrides prevent shared button/input/tab styles from sticking after a tap.

## Shapes

Small badges use 6px corners; buttons, fields and small brand images use 8px; app panels, tables, dialogs and mascot use 16px. Discord avatars are circular and native embeds use 4px corners with the real app's green accent. This native embed treatment is not a general callout style. The supplied artwork keeps its intrinsic square aspect ratio and original colors. No distortion, extra costume or CSS redrawing.

## Components

### Brand marks

Root `kappa.svg` is the canonical supplied logo and mascot. `KappaMark` imports it directly; the root file is not copied or modified. Images declare their intrinsic dimensions, with CSS setting display size. Marks beside a named wordmark or bot author are decorative (`alt=""`); the home link supplies the accessible name. The same artwork appears in navigation, footer, bot avatar and preview header. Desktop mascot sizing belongs to the surface brief.

### Buttons

`DiscordLogin` supplies consistent official branding for sign-in, reconnect and auth recovery. Shared application buttons use 48px height (44px compact); homepage primary actions use 52px. Standard action colors are green, subtle outlined neutral, and semantic destructive red. Authenticated “Open dashboard” remains green; sign-in remains Discord Blurple. Mouse hover is capability-gated. Keep one control per action and target: dashboard navigation lives in its sidebar, auth recovery owns its retry action, subscription forms use Cancel without a second Close, and CV removal replaces the original controls with confirmation and Cancel. Row actions for distinct jobs/subscriptions remain separate.

### Inputs / Fields

Shared fields retain visible labels, 16px entry text, 48px minimum height, input-edge borders and contextual error/disabled states. CV upload uses native file input with a green-tinted selector button. Its panel shows only filename and uploaded date (or no-CV status), with replacement and confirmed removal; no textarea, extracted text, character count or download is presented. All PDF/TXT/MD extraction is server-side, and the file selector clears after each choice to allow retrying the same file. No Discord reply input remains: that preview is static.

### Navigation and chips

The homepage retains its inline named anchors beside the supplied logo and lowercase wordmark. The dashboard sidebar presents Home, personal Jobs and personal Settings, followed by a labeled managed Discord Server picker. Selecting a server reveals its nested Jobs and Settings links; active selection is URL-based and the last selected server remains available while visiting personal pages. Sidebar Account and Sign out controls remain separate from subscription settings. Home summarizes existing personal subscriptions/CV and links to managed servers; it does not invent activity. Home also lists personal CV reports with unique report numbers, batch size, creation date and result state. Detail pages show an A–E overall grade, the CV filename/date used, average skills/experience/keyword factors, employer requirements, candidate fit, gaps, suitable roles and all 20 included job links. Three-column factors and two-column summaries stack on mobile. Missing CV and unavailable assessments are explicit states, never fabricated scores. Report text never exposes extracted CV passages. Personal Settings contains CV upload/replacement, subscription creation and management; server Settings contains only that server's subscriptions and the existing Discord creation instruction. Personal CVs never appear in server pages. Personal job match cells show an A–E grade and a native disclosure for skills, relevant experience and keyword match scores, with 50%/35%/15% weights and job-focused explanations. The factor breakdown is readable on desktop and mobile. Unassessed jobs show that state explicitly; legacy grades have no invented breakdown. Fine-pointer hover is capability-gated. Noninteractive source badges use tinted paper and muted text; active statuses use accent-soft and accent. No fabricated badge interactions.

### Pricing plans

Free and Premium use equal flat columns separated by space, each beginning with a one-pixel rule. Plan names are 32px; the Premium availability status is inline, 13px medium-weight muted text. Free retains its features; the single homepage sign-in action lives in the hero rather than being duplicated in pricing. Upcoming Premium has no purchase action, invented price or launch date. The status is functional availability information, not an eyebrow.

### Product previews and disclosures

The Discord preview is a static conversation transcribed from supplied `image.png`: four numbered title/company lines, a user reply and a detailed Indonesian summary. There is no reply form, reset button or fake clickable title. The blue title treatment reproduces the real message. The dashboard preview retains search and keyboard tabs. Ancillary demo captions and promotional helper links remain omitted. Application filters, summary/edit/delete dialogs, CV confirmation and account-deletion phrase remain functional and accessible. Preview tabs use the shared component under local theme overrides; spacing below the tab strip is 4px, avoiding the former redundant gap before search. Native FAQ details retain visible focus and reversible chevrons.

The sidecar contains scoped, self-contained visual recipes for primitives. It omits React behavior rather than claiming static examples are a functional application.

## Do's and Don'ts

### Do:

- Do reuse shared palette, Onest, branding and control recipes across the web app.
- Do use the supplied `kappa.svg` unchanged for logo and mascot imagery.
- Do prioritize readable job-finding content over saturated fields or additional mascot decoration.
- Do retain working preview interactions and accessible field labels; omit ancillary preview captions and promotional helper links.

### Don't:

- Don't use the homepage display scale on task-oriented app headings.
- Don't recolor or reconstruct the supplied mascot.
- Don't promote this route's composition into a universal screen layout.
