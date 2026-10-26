import {
  mutationOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  ApiError,
  createSubscription,
  deleteAccount,
  deleteCv,
  deleteSubscription,
  fetchAccountSummary,
  fetchCv,
  fetchGuilds,
  fetchJobs,
  fetchMe,
  fetchSubscriptions,
  logout,
  saveCv,
  saveCvFile,
  updateSubscription,
} from "./api";
import type {
  JobsParams,
  SaveCvBodyType,
  UpdateSubscriptionBodyType,
} from "./api";

export type {
  CvDtoType,
  GuildDtoType,
  JobDtoType,
  JobsParams,
  SaveCvBodyType,
  SubscriptionDtoType,
} from "./api";
export { ApiError } from "./api";

export const queryKeys = {
  me: ["me"] as const,
  cv: ["cv"] as const,
  subscriptions: ["subscriptions"] as const,
  jobs: ["jobs"] as const,
  subscriptionList: (guildId?: string) =>
    ["subscriptions", guildId ?? "mine"] as const,
  guilds: ["guilds"] as const,
  accountSummary: ["account-summary"] as const,
};

export const apiMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
};

/** Current session user, or null when signed out. Never retries auth. */
export const useMe = () =>
  useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

/** Redirects to `/` when signed out. Returns the `useMe()` query as-is. */
export const useRequireAuth = () => {
  const navigate = useNavigate();
  const me = useMe();
  useEffect(() => {
    if (me.data === null) {
      void navigate({ to: "/" });
    }
  }, [me.data, navigate]);
  return me;
};

export const useSubscriptions = (enabled: boolean, guildId?: string) =>
  useQuery({
    queryKey: queryKeys.subscriptionList(guildId),
    queryFn: () => fetchSubscriptions(guildId),
    enabled,
    retry: false,
  });

export const useGuilds = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.guilds,
    queryFn: fetchGuilds,
    enabled,
    retry: false,
    staleTime: 60_000,
  });

export const useJobs = (enabled: boolean, params: JobsParams) =>
  useQuery({
    queryKey: [...queryKeys.jobs, params],
    queryFn: () => fetchJobs(params),
    enabled,
    retry: false,
    placeholderData: (previous) => previous,
  });

export const createSubscriptionOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: ({ source, keywords }: { source: string; keywords: string }) =>
      createSubscription({ source, keywords }),
    // Creation is DM-only; the account summary includes the DM count.
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.subscriptions }),
        client.invalidateQueries({ queryKey: queryKeys.accountSummary }),
      ]),
  });

export const updateSubscriptionOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: ({
      id,
      patch,
    }: {
      id: number;
      patch: UpdateSubscriptionBodyType;
    }) => updateSubscription(id, patch),
    onSuccess: (sub, { patch }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.subscriptions }),
        // Only active-state edits change the guild summary's counts.
        ...(sub.scope === "guild" && patch.isActive !== undefined
          ? [client.invalidateQueries({ queryKey: queryKeys.guilds })]
          : []),
      ]),
  });

export const deleteSubscriptionOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: (id: number) => deleteSubscription(id),
    // Delete returns only a summary, so its scope is not available here.
    // Delivered jobs are removed with the subscription, including their totals.
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.subscriptions }),
        client.invalidateQueries({ queryKey: queryKeys.guilds }),
        client.invalidateQueries({ queryKey: queryKeys.accountSummary }),
        client.invalidateQueries({ queryKey: queryKeys.jobs }),
      ]),
  });

export const useCreateSubscription = () =>
  useMutation(createSubscriptionOptions(useQueryClient()));

export const useUpdateSubscription = () =>
  useMutation(updateSubscriptionOptions(useQueryClient()));

export const useDeleteSubscription = () =>
  useMutation(deleteSubscriptionOptions(useQueryClient()));

export const useCv = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.cv,
    queryFn: fetchCv,
    enabled,
    retry: false,
  });

export const useSaveCv = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveCvBodyType) => saveCv(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.cv });
    },
  });
};

export const useSaveCvFile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => saveCvFile(file),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.cv });
    },
  });
};

export const useDeleteCv = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteCv,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.cv });
    },
  });
};

export const useAccountSummary = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.accountSummary,
    queryFn: fetchAccountSummary,
    enabled,
    retry: false,
  });

export const useDeleteAccount = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      client.clear();
    },
  });
};

export const useLogout = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      client.clear();
    },
  });
};
