# Kappa — Job listings

Kappa is a subscription application. Job listings are its current sub-app; Discord is an interaction and delivery channel, not the product itself.

## Language

**JobSubscription**: A personal or server-owned subscription to job postings matching selected sources and search criteria, delivered to a chosen destination. _Avoid_: Watch, Feed, generic Subscription when the job-listings context is not clear

**Keyword alternative**: One search criterion within a JobSubscription, requiring all of its search terms. A posting may match any alternative; the subscription's other filters apply to every alternative. _Avoid_: Parameter, separate subscription for each alternative

**Subscription title**: An optional display name for a JobSubscription, independent of its search criteria. _Avoid_: Keyword, requiring a unique title

**Work environment**: A posting's stated arrangement: onsite, remote, or hybrid. An unspecified or ambiguous arrangement is unknown, not evidence of any particular environment. _Avoid_: Treating hybrid as remote, inferring remote from flexible hours

**Minimum salary**: An optional salary threshold in IDR per month for a JobSubscription; an advertised upper bound at or above the threshold qualifies even if the lower bound is below it. A lower-bound-only salary below the threshold does not establish whether the posting qualifies. _Avoid_: Salary range filter, maximum salary filter, guaranteed minimum pay

**Posting facts**: Salary and work-environment information explicitly supported by a posting's source fields or original text. Missing or ambiguous evidence is unknown; an unsuccessful attempt to obtain the evidence does not establish that it is unspecified. _Avoid_: Estimated salary, guessed work environment

**Posting evaluation**: The determination of whether a posting satisfies a JobSubscription's filters using supported posting facts. Pending or failed evaluation is distinct from a completed evaluation that finds unspecified information or rejects the posting. _Avoid_: Treating evaluation failure as no matching jobs

**JobPosting**: A normalized external job opportunity identified by its source and that source's posting ID. _Avoid_: Vacancy, mixing Job and Listing as separate domain concepts

**Source selection**: The sources a JobSubscription requests: a concrete job source or all enabled sources. _Avoid_: Calling “all” a job source

**Personal scope**: A person's private subscriptions and CV matching. Only that person may manage them. _Avoid_: Personal guild

**Server scope**: Subscriptions owned by a server and managed by people with current server-management permission; historical creation does not grant continuing access. _Avoid_: Creator ownership

**SeenJob**: A per-subscription deduplication claim for a posting. A claim is not proof that delivery succeeded. _Avoid_: DeliveredJob, SentJob

**Delivery**: A successfully sent message containing a posting or a page of postings. Reply numbers identify the postings actually shown in that message. _Avoid_: Using claimed postings as a synonym for delivered postings

**Retention**: The lifetime of stored subscription history and deduplication claims, not the age window searched at external sources. _Avoid_: Search window
