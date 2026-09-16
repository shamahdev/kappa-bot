import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  createSubscription,
  deleteAccount,
  deleteSubscription,
  fetchAccountSummary,
  fetchMe,
  fetchSubscriptions,
  logout,
  updateSubscription,
  type SubscriptionDtoType,
  type UpdateSubscriptionBodyType,
} from './api';

export { ApiError };
export type { SubscriptionDtoType };

export const queryKeys = {
  me: ['me'] as const,
  subscriptions: ['subscriptions'] as const,
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

export function useSubscriptions(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: fetchSubscriptions,
    enabled,
    retry: false,
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
