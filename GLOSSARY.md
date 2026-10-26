# Kappa — Job listings

Kappa is a subscription application. Job listings are its current sub-app; Discord is an interaction and delivery channel, not the product itself.

## Language

**JobSubscription**: A personal or server-owned subscription to job postings matching selected sources and search criteria, delivered to a chosen destination. _Avoid_: Watch, Feed, generic Subscription when the job-listings context is not clear

**JobPosting**: A normalized external job opportunity identified by its source and that source's posting ID. _Avoid_: Vacancy, mixing Job and Listing as separate domain concepts

**Source selection**: The sources a JobSubscription requests: a concrete job source or all enabled sources. _Avoid_: Calling “all” a job source

**Personal scope**: A person's private subscriptions and CV matching. Only that person may manage them. _Avoid_: Personal guild

**Server scope**: Subscriptions owned by a server and managed by people with current server-management permission; historical creation does not grant continuing access. _Avoid_: Creator ownership

**SeenJob**: A per-subscription deduplication claim for a posting. A claim is not proof that delivery succeeded. _Avoid_: DeliveredJob, SentJob

**Delivery**: A successfully sent message containing a posting or a page of postings. Reply numbers identify the postings actually shown in that message. _Avoid_: Using claimed postings as a synonym for delivered postings

**Retention**: The lifetime of stored subscription history and deduplication claims, not the age window searched at external sources. _Avoid_: Search window
