import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  ApiError,
  createSubscription,
  deleteAccount,
  deleteSubscription,
  fetchAccountSummary,
  fetchGuilds,
  fetchJobs,
  fetchMe,
  fetchSubscriptions,
  logout,
  updateSubscription,
  type GuildDtoType,
  type JobDtoType,
  type JobsParams,
  type SubscriptionDtoType,
  type UpdateSubscriptionBodyType,
} from './api';

export { ApiError };
export type { GuildDtoType, JobDtoType, JobsParams, SubscriptionDtoType };

export const queryKeys = {
  me: ['me'] as const,
  subscriptions: ['subscriptions'] as const,
  subscriptionList: (guildId?: string) => ['subscriptions', guildId ?? 'mine'] as const,
  guilds: ['guilds'] as const,
  accountSummary: ['account-summary'] as const,
};

export function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** Current session user, or null when signed out. Never retries auth. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });
}

/** Redirects to `/` when signed out. Returns the `useMe()` query as-is. */
export function useRequireAuth() {
  const navigate = useNavigate();
  const me = useMe();
  useEffect(() => {
    if (me.data === null) void navigate({ to: '/' });
  }, [me.data, navigate]);
  return me;
}

export function useSubscriptions(enabled: boolean, guildId?: string) {
  return useQuery({
    queryKey: queryKeys.subscriptionList(guildId),
    queryFn: () => fetchSubscriptions(guildId),
    enabled,
    retry: false,
  });
}

export function useGuilds(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.guilds,
    queryFn: fetchGuilds,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useJobs(enabled: boolean, params: JobsParams) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => fetchJobs(params),
    enabled,
    retry: false,
    placeholderData: (previous) => previous,
  });
}

export function useCreateSubscription() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ source, keywords }: { source: string; keywords: string }) =>
      createSubscription({ source, keywords }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.subscriptions });
    },
  });
}

export function useUpdateSubscription() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: UpdateSubscriptionBodyType }) =>
      updateSubscription(id, patch),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.subscriptions });
    },
  });
}

export function useDeleteSubscription() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSubscription(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.subscriptions });
    },
  });
}

export function useAccountSummary(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.accountSummary,
    queryFn: fetchAccountSummary,
    enabled,
    retry: false,
  });
}

export function useDeleteAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      client.clear();
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      client.clear();
    },
  });
}
