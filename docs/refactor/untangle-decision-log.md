# Untangle decision log

## Contract

Refactor the owned application and package source so related changes have an explicit home and remove redundant comments. Preserve HTTP paths, database layout, owner-only personal data, server-management authorization, provider request ordering, claim-first delivery, report retry and notification semantics, and existing frontend behavior.

The user subsequently removed tests from scope. New regression tests were removed; no further test additions, cleanup or runs are requested. Existing test imports/config inputs still need to remain compatible with moved interfaces.

Baseline: 144 unit/server-render tests and 4 DOM interaction tests pass; all five workspaces typecheck. Existing untracked landing-dusk and landing-print files are user work and excluded from edits.

Audit findings are claims, not automatic fixes. The three-round fuse comes from the workspace MSW policy, not a new refactor budget.

## Round 1: redesign from the initial audit

- Define route templates once in contracts and derive client paths from them; service controllers mount those templates.
  - `packages/contracts/src/paths.ts` duplicates literal paths in all eight service route files.
  - Dynamic application, subscription and report paths have separately maintained client builders and server templates.
- Put HTTP identity resolution and job-access error translation outside individual route modules.
  - All authenticated controllers repeat cookie-to-session resolution and the unauthorized envelope.
  - `routes/jobs.ts` and `routes/guilds.ts` import shared access behavior from `routes/subscriptions.ts`.
  - `core/cookies.ts` and `routes/auth.ts` independently define the session lifetime; OAuth requested and persisted scopes are separate literals.
- Share CV format classification, filename/text bounds and size calculations in contracts; retain adapter-specific presentation.
  - Service CV application, Discord upload and web upload independently classify PDF/TXT/MD.
  - CV upload limits and their human-readable labels can drift across those callers.
  - `saveFile` invokes `this.savePdf`, imposing an undocumented receiver requirement.
- Collect source normalization and identical search predicates beside source adapters.
  - Glints, Kalibrr and Tech in Asia copy `formatAgo`.
  - Kalibrr and Tech in Asia copy `stripHtml`.
  - Glints, Indeed and Jobstreet copy `resultLimit` and keyword token matching.
  - Salary normalization has provider-specific differences: retain those rather than change their interpretation.
- Make Discord registration and dispatch use the same subcommand definitions; place interaction helpers and result views outside command-only folders.
  - `features/job-listings/index.ts` maintains a builder and a separate dispatch switch.
  - Commands emit picker IDs that component handling independently enumerates.
  - Component events import views and helpers from command implementation files.
  - Embed colors and active-subscription filtering are copied.
- Give Discord notifications explicit transport/config dependencies and use validated startup configuration.
  - Notifications read `WEB_URL`/`DISCORD_TOKEN` behind the caller's back.
  - `BOT_ROLE` is selected and validated separately.
  - Registry loading is copied at startup and twice inside manual command synchronization.
  - `defineFeature` is an identity wrapper; unused `once`/description features are speculative.
- Keep database connection ownership with the caller that created it.
  - `packages/db/src/db.ts` stored the most recently created pool in a module variable; `closeDb()` could therefore close another caller's pool.
  - Each composition site now closes its own returned pool directly; a pass-through `closeDb(pool)` wrapper was unnecessary.
- Make frontend query identities explicit and keep API feedback outside reusable UI primitives.
  - `queries.ts` mixes central keys with repeated report/application literals.
  - `ui.tsx` imports the volatile API/query implementation for login and errors.
  - DTO types are re-exported through API and query files instead of imported from contracts.
  - Queries expose enablement parameters that every actual caller passes as true.
  - Account styling depends on a sibling settings route's stylesheet name. The stylesheet has only an account consumer, so it is now `account.module.css`, not a new shared stylesheet.
- Share posting text normalization and derived default policies where the audit proves they represent the same requirement.
  - PDF extraction and Discord descriptions copy newline normalization.
  - Schema defaults and fallback defaults independently specify retention, source and polling interval.
- Centralize subscription-to-search translation and posting order.
  - Polling and latest-posting lookup separately construct the same query fields.
  - Latest lookup and Discord delivery independently sort posting timestamps; the former incorrectly treated the Unix epoch as undated. Both now use the same stable ordering, including valid epoch dates.
  - Source fallback detail and enrichment fallback separately map the same listing fields.
  - Match persistence writes repeat the same score/factor/reason mapping; the two owner-scoped lookup strategies remain separate.
- Remove demonstrably unused exports and redundant commentary. Test cleanup was initially selected and subsequently stopped at the user's request.
  - Alias identity assertions on supported sources and CV max bytes repeat assignments.
  - Pure structure assertions should not replace tests of permissions, public command options or endpoint compatibility.

## Findings retained or rejected

- Equal durations for unrelated session, scraper-age and recall policies are not one policy; do not merge them.
- Provider retries, sleeps, circuit breakers, serial paging and parser fallbacks encode external behavior; retain them.
- `dm:` storage encoding is already owned by the subscription domain; historical SQL migrations must not be rewritten.
- Report no-CV/unavailable states, summary failure handling, background generation and optional notification adapters are requirements, not removable exceptions.
- Transaction-compatible cleanup is needed for atomic account deletion; its database interface is not surplus.
- Test injection seams are real consumers; an export used by meaningful module tests is not dead.
- Contracts schemas used by other schemas are not dead just because apps do not import them directly.
- Mapping persistence dates into wire strings and explicitly redacting personal scores are adapter responsibilities; they need not disappear.
- Discord SDK `PermissionsBitField.has(ManageGuild)` accounts for Administrator by default; the audit's claim of an authorization mismatch is not established.
- Legacy redirect routes may be bookmarked externally; keep them.
- Static rendering tests can protect links, free-plan constraints and HTML accessibility; copy-only assertions will be judged individually, not deleted wholesale.
- Generic plugin extraction or a new shared runtime package is not justified by the present application's requirements.
- Provider-specific salary shapes, country defaults, HTML fallback selection and search haystacks are different requirements; identical-looking adapters need not become one configurable scraper.
- HTTP, Discord and web use different presentation text and error masking rules; do not merge their output formatters indiscriminately.
- Adding an application barrel that merely re-exports every factory would relocate imports without removing composition knowledge; the HTTP use cases keep their focused imports.
- `application/ports.ts` has internal type-only links to implementation factories. They do not create runtime cycles or impose private members on external callers; replacing them with duplicate interfaces is not required.
- Report generation's lock, ordered writes, retries, snapshot reset, publication guard and notification lease are preserved. No separate bug hunt or report-workflow redesign was undertaken.
- AI credentials and provider state remain owned by the infrastructure adapter; moving all provider configuration into a new runtime framework is not necessary for this contract.
- Repeated endpoint error envelopes have a shared constructor; raw typed error-code literals need no parallel enum or dispatch framework.
- The top-level feature loader and two filtered Discord interaction listeners still implement current discovery/routing behavior; replacing them is not necessary.
- Date formatters intentionally use different date/time presentations; a format-options abstraction would not remove a shared policy.
- User-facing title fallbacks, board pipeline choices and route-specific navigation states remain presentation requirements, not structural defects requiring another module.
- In-memory test database placement was left unchanged after tests were removed from scope.

## Round 2: local review

The initial audit agents completed their read-only findings. Implementation/follow-up agent requests then failed with `API budget exhausted`; no worker edits were saved. Work continued locally without repeatedly retrying those requests.

The local review found and removed newly exposed pass-throughs (`closeDb(pool)` and duplicate CV constant aliases), moved API error messaging out of query hooks, and retained the existing permission checks and transport failure behavior. Source search caps, byte limits, pagination bounds, cookie lifetime and retention values are all inherited from existing code/contract policy; no new limits were introduced.

The runtime import graph was extracted from actual TypeScript/TSX import statements with ast-grep: 159 owned source modules, 315 relative runtime import edges, no cycles. Type-only imports, generated route trees, tests and pre-existing untracked landing designs are excluded from that measurement.

Independent follow-up reviews subsequently completed using explicitly selected GPT 6.1 Sol after provider budget/decode failures. Service/contracts/database and source-adapter reviews reported no actionable findings in their scopes. Discord and frontend identified the remaining claims below; neither established an introduced behavior regression.

## Round 3: independent review corrections

- Derive picker actions from the same ID table used by commands, without decoding a prefix convention.
  - `events/components.ts` accepted IDs through `PICKER_IDS` but separately derived the action with `.slice("jobs:".length)`. Changing an ID in the table alone could leave it accepted but undispatchable.
  - Keep the emitted IDs, strict numeric parser, fetch-only `all` choice and authorization checks unchanged.
- Finish local-only visibility cleanup by removing export modifiers, not implementations.
  - Discord `loadFeatures`, `formatCardDescription`, `formatSourceTitle` and `healthEmbed` have only same-file callers.
- Make Home's first delivered-job page use the Jobs pagination policy it promises to share.
  - `home-panels.tsx` still specified `pageSize: 20` separately from `DEFAULT_JOB_PAGE_SIZE`.
- Remove orphaned web CV paths while retaining service compatibility.
  - The old `TextArea` wrapper's underlying tracked `shadcn/textarea.tsx` has no consumer after the wrapper removal.
  - `useSaveCv` and its text-PUT fetcher `saveCv` have no frontend consumer; file upload uses `useSaveCvFile`. Remove only the unused frontend branch, leaving the service PUT endpoint unchanged.

These are the last review corrections under the workspace's three-round fuse. Follow-up verification is limited to these corrections and existing acceptance checks, not another open-ended audit.

The Discord and frontend reviewers independently confirmed all their claims resolved after these corrections. Picker IDs, fetch-only `all`, strict numeric validation, authorization order, active file-CV upload/cache invalidation and the service's compatible PUT endpoint remain unchanged. All four review scopes have completed; no identified actionable claim remains open.

## Verification

- All five workspace typechecks pass after the refactor.
- Repository lint passes.
- Production web client, SSR and Nitro builds pass; renamed account styles and moved feedback modules resolve correctly.
- `git diff --check` passes.
- After round 3 corrections, all five workspace typechecks, repository lint, targeted formatting checks and `git diff --check` pass again. No tests were run.
- Before tests were removed from scope, the existing test suite passed during implementation. No new tests remain, and tests were not rerun after the user's instruction. Final runtime behavior is therefore not proven by a final test run.
- Pre-existing untracked landing-dusk and landing-print files were left untouched. Database migrations and persistent data were not changed.
