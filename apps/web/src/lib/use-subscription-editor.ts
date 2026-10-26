import { useState } from "react";

import type { UpdateSubscriptionBodyType } from "./api";
import { apiMessage, useUpdateSubscription } from "./queries";
import type { SubscriptionDtoType } from "./queries";

export interface SubscriptionDraft {
  keywords: string;
  location: string;
  retentionDays: string;
}

type Field = keyof SubscriptionDraft;
export type SubscriptionFieldErrors = Partial<Record<Field, string>>;

type ParsedDraft =
  | { ok: true; patch: UpdateSubscriptionBodyType }
  | { ok: false; errors: SubscriptionFieldErrors };

/** Parse the entire draft; never truncate a number or silently omit an invalid field. */
export const parseSubscriptionDraft = (
  draft: SubscriptionDraft
): ParsedDraft => {
  const errors: SubscriptionFieldErrors = {};
  const keywords = draft.keywords.trim();
  const location = draft.location.trim();
  const retentionText = draft.retentionDays.trim();
  const retentionDays = Number(retentionText);

  if (!keywords) {
    errors.keywords = "Keywords must not be blank.";
  }
  if (!location) {
    errors.location = "Location must not be blank.";
  }
  // This mirrors the existing service contract, not a new frontend limit.
  // The service remains authoritative for every submitted patch.
  if (
    !/^\d+$/u.test(retentionText) ||
    retentionDays < 1 ||
    retentionDays > 365
  ) {
    errors.retentionDays = "Enter a whole number from 1 to 365.";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, patch: { keywords, location, retentionDays } };
};

/** Owns draft validation and mutation coordination; the panel only renders fields. */
export const useSubscriptionEditor = (
  sub: SubscriptionDtoType,
  onDone: () => void
) => {
  const update = useUpdateSubscription();
  const [draft, setDraft] = useState<SubscriptionDraft>(() => ({
    keywords: sub.keywords ?? "",
    location: sub.location ?? "",
    retentionDays: String(sub.retentionDays),
  }));
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});

  const setField = (field: Field, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const submit = () => {
    if (update.isPending) {
      return;
    }
    update.reset();
    const parsed = parseSubscriptionDraft(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    update.mutate({ id: sub.id, patch: parsed.patch }, { onSuccess: onDone });
  };

  return {
    draft,
    errors,
    setField,
    submit,
    isPending: update.isPending,
    errorMessage: update.isError ? apiMessage(update.error) : null,
  };
};
