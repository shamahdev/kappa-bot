import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";
import type { SubscriptionDtoType } from "@kappa/contracts";
import { useState } from "react";

import { apiMessage } from "../lib/api";
import {
  useCreateSubscription,
  useDeleteSubscription,
  useUpdateSubscription,
  useRetrySubscription,
} from "../lib/queries";
import {
  useSubscriptionEditor,
  parseSubscriptionDraft,
} from "../lib/use-subscription-editor";
import type {
  SubscriptionDraft,
  SubscriptionFieldErrors,
} from "../lib/use-subscription-editor";
import { SubscriptionOptions } from "./subscription-options";
import {
  Badge,
  Button,
  EmptyList,
  ErrorNote,
  HStack,
  Modal,
  Select,
  Text,
  TextInput,
  VStack,
} from "./ui";

import styles from "./data-views.module.css";

export type OpenPanel = { id: number; mode: "edit" | "delete" } | null;

export const formatDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

export const CreateForm = ({ guildId }: { guildId?: string }) => {
  const create = useCreateSubscription();
  const [source, setSource] = useState<string>(SUBSCRIPTION_SOURCES[0]);
  const [keywords, setKeywords] = useState("");
  const [channelId, setChannelId] = useState("");
  const [draft, setDraft] = useState<SubscriptionDraft>({
    keywords: "",
    location: "Indonesia",
    retentionDays: "14",
    title: "",
    minimumSalary: "",
    workEnvironments: [],
    includeUnspecifiedSalary: false,
    includeUnspecifiedEnvironment: false,
  });
  const [errors, setErrors] = useState<SubscriptionFieldErrors>({});
  const submitLabel = guildId
    ? "New server subscription"
    : "New DM subscription";
  const setField = <K extends keyof SubscriptionDraft>(
    key: K,
    value: SubscriptionDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        create.reset();
        const parsed = parseSubscriptionDraft({ ...draft, keywords });
        if (!parsed.ok) {
          setErrors(parsed.errors);
          return;
        }
        setErrors({});
        const { retentionDays: _retention, ...options } = parsed.patch;
        create.mutate(
          {
            ...options,
            source,
            keywords: keywords.trim(),
            ...(guildId ? { guildId, channelId: channelId.trim() } : {}),
          },
          { onSuccess: () => setKeywords("") }
        );
      }}
    >
      <VStack gap={3}>
        <div className={styles.filters}>
          <Select
            disabled={create.isPending}
            label="Source"
            onChange={setSource}
            options={[...SUBSCRIPTION_SOURCES]}
            value={source}
          />
          <TextInput
            description="Separate alternatives with commas. Match any alternative; all words within each alternative are required."
            disabled={create.isPending}
            label="Keywords"
            onChange={(event) => {
              setKeywords(event.target.value);
              setErrors((current) => ({ ...current, keywords: undefined }));
            }}
            placeholder="e.g. frontend, nextjs, fullstack"
            error={errors.keywords}
            value={keywords}
          />
        </div>
        <TextInput
          label="Location"
          value={draft.location}
          error={errors.location}
          disabled={create.isPending}
          onChange={(event) => setField("location", event.target.value)}
        />
        {guildId ? (
          <TextInput
            label="Discord text channel ID"
            description="Enable Discord Developer Mode, then copy the channel ID. The bot must have access to this server text channel."
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            disabled={create.isPending}
          />
        ) : null}
        <SubscriptionOptions
          draft={draft}
          setField={setField}
          disabled={create.isPending}
          errors={errors}
        />
        {create.isError ? (
          <ErrorNote>{apiMessage(create.error)}</ErrorNote>
        ) : null}
        <HStack>
          <Button
            disabled={
              create.isPending ||
              !keywords.trim() ||
              Boolean(guildId && !channelId.trim())
            }
            loading={create.isPending}
            type="submit"
          >
            {create.isPending ? "Creating…" : submitLabel}
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};

const EditPanel = ({
  sub,
  onDone,
}: {
  sub: SubscriptionDtoType;
  onDone: () => void;
}) => {
  const editor = useSubscriptionEditor(sub, onDone);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        editor.submit();
      }}
    >
      <VStack gap={4}>
        <TextInput
          disabled={editor.isPending}
          error={editor.errors.keywords}
          label="Keywords"
          description={
            sub.keywordAlternatives === null ||
            sub.keywordAlternatives === undefined
              ? "Legacy search: unchanged text stays one search. Editing keywords enables comma-separated alternatives."
              : "Separate alternatives with commas. Match any alternative."
          }
          onChange={(event) => editor.setField("keywords", event.target.value)}
          value={editor.draft.keywords}
        />
        <TextInput
          disabled={editor.isPending}
          error={editor.errors.location}
          label="Location"
          onChange={(event) => editor.setField("location", event.target.value)}
          value={editor.draft.location}
        />
        <SubscriptionOptions
          draft={editor.draft}
          setField={editor.setField}
          disabled={editor.isPending}
          errors={editor.errors}
        />
        <TextInput
          disabled={editor.isPending}
          error={editor.errors.retentionDays}
          label="Retention (days)"
          onChange={(event) =>
            editor.setField("retentionDays", event.target.value)
          }
          value={editor.draft.retentionDays}
        />
        {editor.errorMessage ? (
          <ErrorNote>{editor.errorMessage}</ErrorNote>
        ) : null}
        <HStack gap={2} wrap="wrap">
          <Button
            disabled={editor.isPending}
            loading={editor.isPending}
            small
            type="submit"
          >
            {editor.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button
            disabled={editor.isPending}
            onClick={onDone}
            small
            variant="subtle"
          >
            Cancel
          </Button>
        </HStack>
      </VStack>
    </form>
  );
};

const DeletePanel = ({
  sub,
  onDone,
}: {
  sub: SubscriptionDtoType;
  onDone: () => void;
}) => {
  const remove = useDeleteSubscription();
  return (
    <VStack gap={4}>
      <VStack gap={2}>
        <HStack>
          <Badge>{sub.source}</Badge>
        </HStack>
        <Text weight="semibold">{sub.title || sub.keywords || "—"}</Text>
        <div className={styles.meta}>
          <Text as="span" color="secondary">
            {sub.location ?? "—"}
          </Text>
          <Text as="span" color="secondary">
            {sub.scope === "dm" ? "your DMs" : `#${sub.channelId}`}
          </Text>
        </div>
      </VStack>
      <Text color="secondary">
        Past deliveries are deleted with this subscription. This cannot be
        undone.
      </Text>
      {remove.isError ? (
        <ErrorNote>{apiMessage(remove.error)}</ErrorNote>
      ) : null}
      <HStack gap={2} wrap="wrap">
        <Button
          disabled={remove.isPending}
          loading={remove.isPending}
          onClick={() => {
            remove.reset();
            remove.mutate(sub.id, { onSuccess: onDone });
          }}
          small
          variant="danger"
        >
          {remove.isPending ? "Deleting…" : "Confirm delete"}
        </Button>
        <Button
          disabled={remove.isPending}
          onClick={onDone}
          small
          variant="subtle"
        >
          Cancel
        </Button>
      </HStack>
    </VStack>
  );
};

const SubscriptionActions = ({
  sub,
  setOpen,
}: {
  sub: SubscriptionDtoType;
  setOpen: (open: OpenPanel) => void;
}) => {
  const update = useUpdateSubscription();
  const retry = useRetrySubscription();
  return (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap">
        <Button
          disabled={update.isPending}
          loading={update.isPending}
          onClick={() =>
            update.mutate({ id: sub.id, patch: { isActive: !sub.isActive } })
          }
          small
          variant="subtle"
        >
          {sub.isActive ? "Pause" : "Resume"}
        </Button>
        <Button
          onClick={() => setOpen({ id: sub.id, mode: "edit" })}
          small
          variant="subtle"
        >
          Edit
        </Button>
        <Button
          onClick={() => setOpen({ id: sub.id, mode: "delete" })}
          small
          variant="dangerSubtle"
        >
          Delete
        </Button>
        {sub.evaluation?.failed ? (
          <Button
            small
            variant="subtle"
            disabled={retry.isPending}
            loading={retry.isPending}
            onClick={() => retry.mutate(sub.id)}
          >
            Retry extraction
          </Button>
        ) : null}
      </HStack>
      {update.isError ? (
        <ErrorNote>{apiMessage(update.error)}</ErrorNote>
      ) : null}
      {retry.isError ? <ErrorNote>{apiMessage(retry.error)}</ErrorNote> : null}
    </VStack>
  );
};

export const SubscriptionsTable = ({
  subs,
  open,
  setOpen,
  emptyTitle,
  emptyBody,
}: {
  subs: readonly SubscriptionDtoType[];
  open: OpenPanel;
  setOpen: (open: OpenPanel) => void;
  emptyTitle: string;
  emptyBody: string;
}) => {
  const selected = open ? subs.find((sub) => sub.id === open.id) : undefined;
  if (subs.length === 0) {
    return <EmptyList body={emptyBody} title={emptyTitle} />;
  }
  let panel = null;
  if (selected && open) {
    panel =
      open.mode === "edit" ? (
        <EditPanel
          key={selected.id}
          onDone={() => setOpen(null)}
          sub={selected}
        />
      ) : (
        <DeletePanel
          key={selected.id}
          onDone={() => setOpen(null)}
          sub={selected}
        />
      );
  }
  return (
    <>
      <div className={styles.tableFrame}>
        <table aria-label="Subscriptions" className="app-table">
          <thead>
            <tr>
              <th scope="col">Subscription</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sub) => (
              <tr key={sub.id}>
                <td aria-label="Subscription" data-label="Subscription">
                  <VStack gap={2}>
                    <HStack gap={2} wrap="wrap">
                      <Badge>{sub.source}</Badge>
                      <Badge strong={sub.isActive}>
                        {sub.isActive ? "Active" : "Paused"}
                      </Badge>
                    </HStack>
                    <Text weight="semibold">
                      {sub.title || sub.keywords || "—"}
                    </Text>
                    {sub.title ? (
                      <Text color="secondary" type="supporting">
                        {sub.keywords}
                      </Text>
                    ) : null}
                    {sub.workEnvironments?.length ? (
                      <Text color="secondary" type="supporting">
                        {sub.workEnvironments.join(", ")} · unspecified{" "}
                        {sub.includeUnspecifiedEnvironment
                          ? "included"
                          : "excluded"}
                      </Text>
                    ) : null}
                    {sub.minimumSalary === null ||
                    sub.minimumSalary === undefined ? null : (
                      <Text color="secondary" type="supporting">
                        Minimum IDR {sub.minimumSalary.toLocaleString("id-ID")}
                        /month · unspecified{" "}
                        {sub.includeUnspecifiedSalary ? "included" : "excluded"}
                      </Text>
                    )}
                    {sub.evaluation &&
                    (sub.evaluation.pending || sub.evaluation.failed) ? (
                      <Text as="output" color="secondary" type="supporting">
                        Extraction: {sub.evaluation.pending} pending,{" "}
                        {sub.evaluation.failed} failed
                      </Text>
                    ) : null}
                    {sub.evaluation?.unavailable ? (
                      <ErrorNote>{sub.evaluation.unavailable}</ErrorNote>
                    ) : null}
                    <div className={styles.meta}>
                      <Text as="span" color="secondary" type="supporting">
                        {sub.location ?? "—"}
                      </Text>
                      <Text as="span" color="secondary" type="supporting">
                        {sub.scope === "dm"
                          ? "Your DMs"
                          : `Channel #${sub.channelId}`}
                      </Text>
                    </div>
                    <Text color="secondary" type="supporting">
                      Created {formatDate(sub.createdAt)}
                    </Text>
                  </VStack>
                </td>
                <td data-label="Actions">
                  <SubscriptionActions setOpen={setOpen} sub={sub} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        className={styles.subscriptionDialog}
        onClose={() => setOpen(null)}
        open={Boolean(selected)}
        showCloseButton={false}
        title={
          open?.mode === "delete" ? "Delete subscription?" : "Edit subscription"
        }
      >
        {panel}
      </Modal>
    </>
  );
};
