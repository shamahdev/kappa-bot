import {
  isSubscriptionSource,
  SUBSCRIPTION_SOURCES,
  RETENTION_DAYS_MIN,
  RETENTION_DAYS_MAX,
  parseKeywordAlternatives,
  SUBSCRIPTION_TITLE_MAX_CHARS,
  WORK_ENVIRONMENTS,
} from "@kappa/contracts";
import type { WorkEnvironmentType } from "@kappa/contracts";

import type { FingerprintQuery } from "./posting";

export interface JobActor {
  userId: string;
  canManageGuild: (guildId: string) => Promise<boolean>;
  canMentionRole?: (guildId: string, roleId: string) => Promise<boolean>;
}

export type JobScope =
  | { kind: "personal" }
  | { kind: "guild"; guildId: string };

/** Persistence-neutral subscription shape; dates stay dates until presentation. */
export interface JobSubscription {
  id: number;
  guildId: string;
  channelId: string;
  keywords: string | null;
  keywordAlternatives?: string[] | null;
  title?: string | null;
  roleId?: string | null;
  workEnvironments?: WorkEnvironmentType[];
  minimumSalary?: number | null;
  includeUnspecifiedSalary?: boolean;
  includeUnspecifiedEnvironment?: boolean;
  location: string | null;
  geoId: string | null;
  distance: number | null;
  filters: Record<string, string>;
  source: string;
  isActive: boolean;
  retentionDays: number;
  createdBy: string | null;
  createdAt: Date;
}

export const keywordAlternativesForSubscription = (
  sub: JobSubscription
): string[] => sub.keywordAlternatives ?? [sub.keywords ?? ""];

export const subscriptionDisplayTitle = (sub: JobSubscription): string =>
  sub.title || sub.keywords || "—";

export const hasPostingFilters = (sub: JobSubscription): boolean =>
  (sub.minimumSalary !== null && sub.minimumSalary !== undefined) ||
  Boolean(sub.workEnvironments?.length);

export const postingQueryForSubscription = (
  sub: JobSubscription
): FingerprintQuery => ({
  distance: sub.distance,
  filters: sub.filters ?? {},
  geoId: sub.geoId,
  keywords: sub.keywords ?? "",
  location: sub.location,
});

export class JobSubscriptionError extends Error {
  readonly code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION";

  constructor(code: "FORBIDDEN" | "NOT_FOUND" | "VALIDATION", message: string) {
    super(message);
    this.code = code;
    this.name = "JobSubscriptionError";
  }
}

export const nonBlankId = (value: string, label: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new JobSubscriptionError("VALIDATION", `${label} must not be blank`);
  }
  return value;
};

export const dmScopeKey = (userId: string): string =>
  `dm:${nonBlankId(userId, "user id")}`;

export const dmUserIdForScope = (key: string): string | null =>
  key.startsWith("dm:") && key.slice(3).trim() ? key.slice(3) : null;

export const scopeKey = (actor: JobActor, scope: JobScope): string => {
  if (scope.kind === "personal") {
    return dmScopeKey(actor.userId);
  }
  const id = nonBlankId(scope.guildId, "guild id");
  if (id.startsWith("dm:")) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "guild filter must be a server id"
    );
  }
  return id;
};

export const assertScopeAccess = async (
  actor: JobActor,
  scope: JobScope
): Promise<string> => {
  const key = scopeKey(actor, scope);
  if (scope.kind === "guild" && !(await actor.canManageGuild(key))) {
    throw new JobSubscriptionError("FORBIDDEN", "subscription not found");
  }
  return key;
};

export const assertSubscriptionAccess = async (
  actor: JobActor,
  row: JobSubscription
): Promise<void> => {
  if (row.guildId.startsWith("dm:")) {
    if (row.guildId !== dmScopeKey(actor.userId)) {
      throw new JobSubscriptionError("FORBIDDEN", "subscription not found");
    }
    return;
  }
  await assertScopeAccess(actor, { guildId: row.guildId, kind: "guild" });
};

export const positiveSubscriptionId = (id: number): number => {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "subscription id must be a positive integer"
    );
  }
  return id;
};

export const subscriptionSource = (source: string): string => {
  if (!isSubscriptionSource(source)) {
    throw new JobSubscriptionError(
      "VALIDATION",
      `unknown source "${source}" (supported: ${SUBSCRIPTION_SOURCES.join(", ")})`
    );
  }
  return source;
};

export const subscriptionKeywords = (keywords: string): string => {
  if (typeof keywords !== "string" || !keywords.trim()) {
    throw new JobSubscriptionError("VALIDATION", "keywords must not be blank");
  }
  try {
    return parseKeywordAlternatives(keywords).join(", ");
  } catch (error) {
    throw new JobSubscriptionError(
      "VALIDATION",
      error instanceof Error ? error.message : "invalid keywords"
    );
  }
};

export const subscriptionLocation = (location: string): string => {
  if (typeof location !== "string" || !location.trim()) {
    throw new JobSubscriptionError("VALIDATION", "location must not be blank");
  }
  return location.trim();
};

export const subscriptionRetentionDays = (days: number): number => {
  // Existing subscription contract: an integer from 1 through 365 days.
  if (
    !Number.isInteger(days) ||
    days < RETENTION_DAYS_MIN ||
    days > RETENTION_DAYS_MAX
  ) {
    throw new JobSubscriptionError(
      "VALIDATION",
      `retentionDays must be an integer ${RETENTION_DAYS_MIN}–${RETENTION_DAYS_MAX}`
    );
  }
  return days;
};

export interface JobSubscriptionPatch {
  roleId?: string | null;
  title?: string | null;
  workEnvironments?: readonly WorkEnvironmentType[];
  minimumSalary?: number | null;
  includeUnspecifiedSalary?: boolean;
  includeUnspecifiedEnvironment?: boolean;
  keywords?: string;
  location?: string;
  isActive?: boolean;
  retentionDays?: number;
}

const subscriptionPostingOptions = (
  patch: JobSubscriptionPatch
): JobSubscriptionPatch => {
  const result: JobSubscriptionPatch = {};
  if (patch.title !== undefined) {
    if (
      patch.title !== null &&
      (typeof patch.title !== "string" ||
        patch.title.trim().length > SUBSCRIPTION_TITLE_MAX_CHARS)
    ) {
      throw new JobSubscriptionError(
        "VALIDATION",
        `Title must be at most ${SUBSCRIPTION_TITLE_MAX_CHARS} characters.`
      );
    }
    result.title = patch.title?.trim() || null;
  }
  if (patch.minimumSalary !== undefined) {
    if (
      patch.minimumSalary !== null &&
      (typeof patch.minimumSalary !== "number" ||
        !Number.isFinite(patch.minimumSalary) ||
        patch.minimumSalary < 0)
    ) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "Minimum salary must be a non-negative finite number in IDR/month."
      );
    }
    result.minimumSalary = patch.minimumSalary;
  }
  if (patch.workEnvironments !== undefined) {
    if (
      !Array.isArray(patch.workEnvironments) ||
      patch.workEnvironments.some(
        (value) => !(WORK_ENVIRONMENTS as readonly string[]).includes(value)
      )
    ) {
      throw new JobSubscriptionError("VALIDATION", "Unknown work environment.");
    }
    result.workEnvironments = [...new Set(patch.workEnvironments)];
  }
  for (const key of [
    "includeUnspecifiedSalary",
    "includeUnspecifiedEnvironment",
  ] as const) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== "boolean") {
        throw new JobSubscriptionError(
          "VALIDATION",
          `${key} must be a boolean`
        );
      }
      result[key] = patch[key];
    }
  }
  return result;
};

export const subscriptionPatch = (
  patch: JobSubscriptionPatch
): JobSubscriptionPatch => {
  const result = subscriptionPostingOptions(patch);
  if (patch.roleId !== undefined) {
    if (
      patch.roleId !== null &&
      (typeof patch.roleId !== "string" ||
        !/^[1-9]\d{16,19}$/u.test(patch.roleId.trim()))
    ) {
      throw new JobSubscriptionError(
        "VALIDATION",
        "Role ID must be a Discord role ID, or null to remove the tag."
      );
    }
    result.roleId = patch.roleId?.trim() ?? null;
  }
  if (patch.keywords !== undefined) {
    result.keywords = subscriptionKeywords(patch.keywords);
  }
  if (patch.location !== undefined) {
    result.location = subscriptionLocation(patch.location);
  }
  if (patch.isActive !== undefined) {
    if (typeof patch.isActive !== "boolean") {
      throw new JobSubscriptionError(
        "VALIDATION",
        "isActive must be a boolean"
      );
    }
    result.isActive = patch.isActive;
  }
  if (patch.retentionDays !== undefined) {
    result.retentionDays = subscriptionRetentionDays(patch.retentionDays);
  }
  return result;
};

export const assertSubscriptionRole = async (
  actor: JobActor,
  guildId: string,
  roleId: string | null | undefined
): Promise<void> => {
  if (roleId === null || roleId === undefined) {
    return;
  }
  if (guildId.startsWith("dm:")) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "Role tags are only available for server subscriptions."
    );
  }
  if (roleId === guildId || !(await actor.canMentionRole?.(guildId, roleId))) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "Choose a mentionable role in this server. @everyone and managed roles are not supported."
    );
  }
};
