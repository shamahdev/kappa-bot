import { isSubscriptionSource, SUBSCRIPTION_SOURCES } from "@kappa/contracts";

export interface JobActor {
  userId: string;
  canManageGuild: (guildId: string) => Promise<boolean>;
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
  return keywords.trim();
};

export const subscriptionLocation = (location: string): string => {
  if (typeof location !== "string" || !location.trim()) {
    throw new JobSubscriptionError("VALIDATION", "location must not be blank");
  }
  return location.trim();
};

export const subscriptionRetentionDays = (days: number): number => {
  // Existing subscription contract: an integer from 1 through 365 days.
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new JobSubscriptionError(
      "VALIDATION",
      "retentionDays must be an integer 1–365"
    );
  }
  return days;
};

export interface JobSubscriptionPatch {
  keywords?: string;
  location?: string;
  isActive?: boolean;
  retentionDays?: number;
}

export const subscriptionPatch = (
  patch: JobSubscriptionPatch
): JobSubscriptionPatch => {
  const result: JobSubscriptionPatch = {};
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
