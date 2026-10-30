import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";
import { useState } from "react";

import {
  apiMessage,
  useCreateSubscription,
  useDeleteSubscription,
  useUpdateSubscription,
} from "../lib/queries";
import type { SubscriptionDtoType } from "../lib/queries";
import { useSubscriptionEditor } from "../lib/use-subscription-editor";
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

export const CreateForm = () => {
  const create = useCreateSubscription();
  const [source, setSource] = useState<string>(SUBSCRIPTION_SOURCES[0]);
  const [keywords, setKeywords] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        create.reset();
        create.mutate(
          { source, keywords: keywords.trim() },
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
            description="Delivered to your DMs."
            disabled={create.isPending}
            label="Keywords"
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="e.g. backend engineer golang"
            value={keywords}
          />
        </div>
        {create.isError ? (
          <ErrorNote>{apiMessage(create.error)}</ErrorNote>
        ) : null}
        <HStack>
          <Button
            disabled={create.isPending || !keywords.trim()}
            loading={create.isPending}
            type="submit"
          >
            {create.isPending ? "Creating…" : "New DM subscription"}
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
        <Text weight="semibold">{sub.keywords ?? "—"}</Text>
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
      </HStack>
      {update.isError ? (
        <ErrorNote>{apiMessage(update.error)}</ErrorNote>
      ) : null}
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
                    <Text weight="semibold">{sub.keywords ?? "—"}</Text>
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
