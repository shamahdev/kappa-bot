import {
  RETENTION_DAYS_MIN,
  RETENTION_DAYS_MAX,
  parseKeywordAlternatives,
  SUBSCRIPTION_TITLE_MAX_CHARS,
} from "@kappa/contracts";
import type {
  WorkEnvironmentType,
  UpdateSubscriptionBodyType,
  SubscriptionDtoType,
} from "@kappa/contracts";
import { useState } from "react";

import { apiMessage } from "./api";
import { useUpdateSubscription } from "./queries";

export interface SubscriptionDraft {
  keywords: string;
  location: string;
  retentionDays: string;
  title?: string;
  minimumSalary?: string;
  workEnvironments?: WorkEnvironmentType[];
  includeUnspecifiedSalary?: boolean;
  includeUnspecifiedEnvironment?: boolean;
}

type Field = keyof SubscriptionDraft;
export type SubscriptionFieldErrors = Partial<Record<Field, string>>;

type ParsedDraft =
  | { ok: true; patch: UpdateSubscriptionBodyType }
  | { ok: false; errors: SubscriptionFieldErrors };

const parsePostingOptions = (
  draft: SubscriptionDraft
): { errors: SubscriptionFieldErrors; patch: UpdateSubscriptionBodyType } => {
  const errors: SubscriptionFieldErrors = {};
  const title = draft.title?.trim() ?? "";
  if (title.length > SUBSCRIPTION_TITLE_MAX_CHARS) {
    errors.title = `Use at most ${SUBSCRIPTION_TITLE_MAX_CHARS} characters.`;
  }
  const salary = draft.minimumSalary?.trim() ?? "";
  const minimumSalary = salary ? Number(salary) : null;
  if (
    salary &&
    (!/^\d+(?:\.\d+)?$/u.test(salary) ||
      !Number.isFinite(minimumSalary) ||
      (minimumSalary !== null && minimumSalary < 0))
  ) {
    errors.minimumSalary =
      "Enter a non-negative amount in IDR/month, or leave blank.";
  }
  return {
    errors,
    patch: {
      ...(draft.title === undefined ? {} : { title: title || null }),
      ...(draft.minimumSalary === undefined ? {} : { minimumSalary }),
      ...(draft.workEnvironments === undefined
        ? {}
        : { workEnvironments: draft.workEnvironments }),
      ...(draft.includeUnspecifiedSalary === undefined
        ? {}
        : { includeUnspecifiedSalary: draft.includeUnspecifiedSalary }),
      ...(draft.includeUnspecifiedEnvironment === undefined
        ? {}
        : {
            includeUnspecifiedEnvironment: draft.includeUnspecifiedEnvironment,
          }),
    },
  };
};

/** Parse the entire draft; never truncate a number or silently omit an invalid field. */
export const parseSubscriptionDraft = (
  draft: SubscriptionDraft
): ParsedDraft => {
  const { errors, patch } = parsePostingOptions(draft);
  const keywords = draft.keywords.trim();
  const location = draft.location.trim();
  const retentionText = draft.retentionDays.trim();
  const retentionDays = Number(retentionText);
  try {
    parseKeywordAlternatives(keywords);
  } catch (error) {
    errors.keywords =
      error instanceof Error ? error.message : "Invalid keywords.";
  }
  if (!location) {
    errors.location = "Location must not be blank.";
  }
  // This mirrors the existing service contract, not a new frontend limit.
  // The service remains authoritative for every submitted patch.
  if (
    !/^\d+$/u.test(retentionText) ||
    retentionDays < RETENTION_DAYS_MIN ||
    retentionDays > RETENTION_DAYS_MAX
  ) {
    errors.retentionDays = `Enter a whole number from ${RETENTION_DAYS_MIN} to ${RETENTION_DAYS_MAX}.`;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        patch: {
          keywords,
          location,
          retentionDays,
          ...patch,
        },
      };
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
    title: sub.title ?? "",
    minimumSalary:
      sub.minimumSalary === null || sub.minimumSalary === undefined
        ? ""
        : String(sub.minimumSalary),
    workEnvironments: [...(sub.workEnvironments ?? [])],
    includeUnspecifiedSalary: sub.includeUnspecifiedSalary ?? false,
    includeUnspecifiedEnvironment: sub.includeUnspecifiedEnvironment ?? false,
  }));
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});

  const setField = <K extends Field>(field: K, value: SubscriptionDraft[K]) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const submit = () => {
    if (update.isPending) {
      return;
    }
    update.reset();
    // Unrelated edits must not split legacy keyword text or impose new limits on it.
    const unchangedKeywords = draft.keywords === (sub.keywords ?? "");
    const parsed = parseSubscriptionDraft(
      unchangedKeywords ? { ...draft, keywords: "unchanged" } : draft
    );
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    const { keywords, ...other } = parsed.patch;
    update.mutate(
      { id: sub.id, patch: unchangedKeywords ? other : { ...other, keywords } },
      { onSuccess: onDone }
    );
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
