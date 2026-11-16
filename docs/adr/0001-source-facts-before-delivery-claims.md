# Source facts before delivery claims

Salary and work-environment filters depend on evidence that may require a description fetch and AI extraction. Cache source-only facts per posting and keep pending/failed subscription evaluations separate from SeenJob claims; create the claim only after the posting passes its filters. This adds durable evaluation state but prevents transient extraction failures from consuming delivery deduplication claims or bypassing filters through the “include unspecified” option. CV-derived assessments remain private and are never part of the shared facts cache.
