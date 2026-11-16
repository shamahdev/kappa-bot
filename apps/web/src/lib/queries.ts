import type {
  ApplicationDtoType,
  ApplicationStatusType,
  UpdateSubscriptionBodyType,
  CreateSubscriptionBodyType,
} from "@kappa/contracts";
import { DEFAULT_CV_REPORT_PAGE_SIZE } from "@kappa/contracts";
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
  createSubscription,
  deleteAccount,
  deleteCv,
  deleteSubscription,
  fetchAccountSummary,
  createCvReport,
  fetchApplications,
  moveApplication,
  removeApplication,
  retryCvReport,
  trackApplication,
  fetchCv,
  fetchCvReport,
  fetchCvReports,
  fetchGuilds,
  fetchJobs,
  fetchMe,
  fetchSubscriptions,
  logout,
  saveCvFile,
  updateSubscription,
  retrySubscription,
} from "./api";
import type { JobsParams } from "./api";

const REPORTS_KEY = ["cv-reports"] as const;
const REPORT_KEY = ["cv-report"] as const;
export const queryKeys = {
  me: ["me"] as const,
  cv: ["cv"] as const,
  subscriptions: ["subscriptions"] as const,
  jobs: ["jobs"] as const,
  subscriptionList: (guildId?: string) =>
    ["subscriptions", guildId ?? "mine"] as const,
  guilds: ["guilds"] as const,
  accountSummary: ["account-summary"] as const,
  applications: ["applications"] as const,
  cvReports: REPORTS_KEY,
  cvReport: REPORT_KEY,
  reportList: (page: number, pageSize: number) =>
    [...REPORTS_KEY, page, pageSize] as const,
  reportDetail: (id: number) => [...REPORT_KEY, id] as const,
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
    refetchInterval: 30_000,
  });

export const useGuilds = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.guilds,
    queryFn: fetchGuilds,
    enabled,
    retry: false,
    staleTime: 60_000,
  });

export const useJobs = (params: JobsParams) =>
  useQuery({
    queryKey: [...queryKeys.jobs, params],
    queryFn: () => fetchJobs(params),
    retry: false,
    placeholderData: (previous) => previous,
  });

export const createSubscriptionOptions = (client: QueryClient) =>
  mutationOptions({
    mutationFn: (input: CreateSubscriptionBodyType) =>
      createSubscription(input),
    onSuccess: (sub) =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.subscriptions }),
        client.invalidateQueries({ queryKey: queryKeys.accountSummary }),
        ...(sub.scope === "guild"
          ? [client.invalidateQueries({ queryKey: queryKeys.guilds })]
          : []),
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

export const useRetrySubscription = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: retrySubscription,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.subscriptions }),
  });
};

export const useCreateCvReport = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createCvReport,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.cvReports }),
  });
};

export const useCvReports = (
  page = 1,
  pageSize = DEFAULT_CV_REPORT_PAGE_SIZE
) =>
  useQuery({
    queryKey: queryKeys.reportList(page, pageSize),
    queryFn: () => fetchCvReports(page, pageSize),
    retry: false,
  });
export const useCvReport = (id: number) =>
  useQuery({
    queryKey: queryKeys.reportDetail(id),
    queryFn: () => fetchCvReport(id),
    retry: false,
  });
export const useRetryCvReport = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: retryCvReport,
    onSuccess: (report) => {
      client.setQueryData(queryKeys.reportDetail(report.id), report);
      void client.invalidateQueries({ queryKey: queryKeys.cvReports });
    },
  });
};

export const useCv = (enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.cv,
    queryFn: fetchCv,
    enabled,
    retry: false,
  });

const refreshCvDerived = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.cvReports }),
    client.invalidateQueries({ queryKey: queryKeys.cvReport }),
    client.invalidateQueries({ queryKey: queryKeys.jobs }),
    client.invalidateQueries({ queryKey: queryKeys.applications }),
  ]);

export const useSaveCvFile = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => saveCvFile(file),
    onSuccess: (cv) => {
      client.setQueryData(queryKeys.cv, cv);
      void refreshCvDerived(client);
    },
  });
};

export const useDeleteCv = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteCv,
    onSuccess: (cv) => {
      client.setQueryData(queryKeys.cv, cv);
      void refreshCvDerived(client);
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

export const useApplications = () =>
  useQuery({
    queryKey: queryKeys.applications,
    queryFn: fetchApplications,
    retry: false,
  });

const refreshTracking = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.applications }),
    client.invalidateQueries({ queryKey: queryKeys.jobs }),
  ]);

export const useTrackApplication = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { seenJobId: number; status: ApplicationStatusType }) =>
      trackApplication(input.seenJobId, input.status),
    onSettled: () => refreshTracking(client),
  });
};

/** Optimistic so a dropped card stays in its new column while saving. */
export const useMoveApplication = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; status: ApplicationStatusType }) =>
      moveApplication(input.id, input.status),
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: queryKeys.applications });
      const previous = client.getQueryData<readonly ApplicationDtoType[]>(
        queryKeys.applications
      );
      client.setQueryData<readonly ApplicationDtoType[]>(
        queryKeys.applications,
        (rows) =>
          rows?.map((row) =>
            row.id === input.id ? { ...row, status: input.status } : row
          )
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      client.setQueryData(queryKeys.applications, context?.previous);
    },
    onSettled: () => refreshTracking(client),
  });
};

export const useRemoveApplication = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: removeApplication,
    onSettled: () => refreshTracking(client),
  });
};
