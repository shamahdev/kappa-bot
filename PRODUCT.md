# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People following job listings through Discord, personally or in a server they manage.

## Product Purpose

Kappa helps job seekers receive notifications when new postings match their keywords or CV, without repeatedly checking individual job sites. Alerts arrive in Discord; a web dashboard supports browsing and subscription management.

## Capabilities and Constraints

Subscriptions select sources, keywords, and location. Personal and server subscriptions are supported. CV matching is optional; personal CVs stay out of server matches. Every 3 days each user gets one CV report covering all jobs successfully delivered to their DMs in that period; it can also be created manually from the dashboard, covering jobs since the previous report. Reports keep a history, and each shows the +/- score change against the previous completed report. The report assesses every job against one CV snapshot and shows an overall A–E grade, average factors, employer requirements, candidate fit, gaps and suitable roles; the fit paragraph is at most 60 words and each list item at most 12 words. Bot DMs (job cards and report notices) show only the A–E grade; factor details live on the dashboard. Without a CV or a complete assessment, no score is invented. CV management is upload-only: users see uploaded status, filename and upload date, never extracted text. The complete extracted CV is assessed against the original job posting using skills (50%), relevant experience (35%) and keyword match (15%). Results are advisory A–E grades with factor scores and explanations, not hiring probabilities; automatic keywords remain upcoming. Personal delivered jobs can be bookmarked or marked as applied from the Job list and tracked on a Jobs dashboard kanban board (Bookmark, Applied, Interview, Offer, Rejected, plus a hidden Archive); cards are dragged between statuses or moved with a status select. Subscriptions can be paused or removed. Sign-in uses Discord. The dashboard uses a sidebar with Home, personal Jobs and personal Settings (subscription management and CV upload). A managed Discord server picker reveals that server's Jobs and Settings subitems; account details and deletion remain separate. The current homepage's free offering is preserved; paid plans are not implemented (CONTEXT.md). The user-approved Premium roadmap is coming soon: subscriptions to multiple channels via webhooks, configurable notification times, and automatic keywords from a CV. These are upcoming capabilities, not available features; no price or launch date is specified.

## Brand Commitments

Keep the name Kappa and a green identity. Use the supplied root `kappa.svg` unchanged as Kappa's logo and mascot; its muted green anchors the homepage accents. The user requested minimalist color for a job-finding tool and delegated the homepage's palette and typography. Preserve its job-alert purpose, dashboard behavior, FAQ, free offering, and Discord sign-in. The Discord homepage preview is a static content-rich conversation based on the supplied `image.png`; its reply controls are removed. The dashboard preview retains browsing controls. The homepage headline may change to reflect keyword/CV matching and less manual checking of job sites. Sign-in actions use Discord's official white symbol and Blurple, limited to authentication branding. Omit ancillary preview captions, promotional helper labels, and secondary preview links. The current shared visual standard applies to the remaining web pages too: dashboard, personal/server jobs, CV/subscription management, settings, and auth error. Keep permissions, API contracts and mutation behavior unchanged.

## Evidence on Hand

The homepage uses a static Discord conversation transcribed from the supplied `image.png`, with a job-count embed, numbered title/company list, user reply and structured Indonesian summary. It is historical demonstration content, not live job availability. The dashboard preview uses illustrative jobs from showcase-data.ts. No invented testimonials, usage figures, or customer claims.
