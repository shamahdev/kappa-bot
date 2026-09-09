# Kappa Bot — Job Subscription Context

Modular Discord bot that delivers filtered job listings as channel subscriptions, starting with LinkedIn Guest APIs and Neon Postgres.

## Language

**Feature**:
A self-contained bot capability with its own commands, events, schedule and schema slice.
_Avoid_: Module (overloaded), Plugin (implies third-party), Cog

**Subscription**:
A persisted tuple of (guild, channel, filter) that drives scheduled job delivery to a channel.
_In DM scope_: the guild slot holds a synthetic per-user id (`dm:<userId>`), isolating one user's DM subscriptions without a schema change (see ADR-0003); the channel is the bot DM channel.
_Avoid_: Watch, Feed, Alert

**JobPosting**:
An external job listing fetched from a source adapter (e.g. LinkedIn `urn:li:jobPosting:{id}`).
_Avoid_: Listing, Job, Vacancy (ambiguous)

**SeenJob**:
An internal dedup record marking a JobPosting as already delivered for a Subscription.
_Avoid_: DeliveredJob, SentJob

**Source Adapter**:
A feature-local adapter that fetches and normalizes JobPostings from one upstream (LinkedIn Guest, Arbeitnow, etc.) behind a shared `JobSource` interface.
_Avoid_: Provider, Fetcher

**Delivery**:
The poll-to-channel send of new JobPostings for a Subscription, either as a single rich card or a numbered digest list.
_Avoid_: Dispatch, Send, Digest
