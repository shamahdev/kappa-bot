import { SUBSCRIPTION_SOURCES } from "@kappa/contracts";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";

import {
  apiMessage,
  useCreateSubscription,
  useDeleteSubscription,
  useUpdateSubscription,
} from "../lib/queries";
import type { SubscriptionDtoType } from "../lib/queries";
import { useSubscriptionEditor } from "../lib/use-subscription-editor";
import { fonts, tokens } from "../theme.stylex";
import {
  Badge,
  Button,
  EmptyList,
  ErrorNote,
  Select,
  StatusDot,
  TextInput,
} from "./ui";

export const subStyles = stylex.create({
  panel: {
    marginTop: 12,
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: tokens.radiusMd,
    padding: 18,
  },
  formGrid: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  formFieldGrow: { flex: "1 1 220px" },
  formFieldFixed: { flex: "0 1 180px" },
  tableScroll: {
    marginTop: 12,
    overflowX: "auto",
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.line,
    borderRadius: tokens.radiusMd,
  },
  table: {
    width: "100%",
    minWidth: 760,
    borderCollapse: "collapse",
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    color: tokens.muted,
    padding: "10px 14px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.line,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px 14px",
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: tokens.line,
    verticalAlign: "top",
    color: tokens.ink,
    lineHeight: "20px",
  },
  mono: { fontFamily: fonts.mono, fontSize: 13 },
  muted: { color: tokens.muted },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: tokens.muted,
    lineHeight: "21px",
    marginTop: 6,
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    whiteSpace: "nowrap",
  },
  inlinePanel: { padding: "14px", backgroundColor: tokens.surfaceSunken },
  inlineRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  inlineButtons: { display: "flex", gap: 8, marginTop: 12 },
  summaryLine: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: tokens.ink,
    lineHeight: "20px",
  },
  errorGap: { marginTop: 12 },
});

export type OpenPanel = { id: number; mode: "edit" | "delete" } | null;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
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
      onSubmit={(e) => {
        e.preventDefault();
        create.reset();
        create.mutate(
          { source, keywords: keywords.trim() },
          { onSuccess: () => setKeywords("") }
        );
      }}
    >
      <div {...stylex.props(subStyles.formGrid)}>
        <div {...stylex.props(subStyles.formFieldFixed)}>
          <Select
            disabled={create.isPending}
            label="Source"
            onChange={setSource}
            options={[...SUBSCRIPTION_SOURCES]}
            value={source}
          />
        </div>
        <div {...stylex.props(subStyles.formFieldGrow)}>
          <TextInput
            description="Delivered to your DMs."
            disabled={create.isPending}
            label="Keywords"
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="e.g. backend engineer golang"
            value={keywords}
          />
        </div>
        <Button disabled={create.isPending || !keywords.trim()} type="submit">
          {create.isPending ? "Creating…" : "New DM subscription"}
        </Button>
      </div>
      {create.isError ? (
        <div {...stylex.props(subStyles.errorGap)}>
          <ErrorNote>{apiMessage(create.error)}</ErrorNote>
        </div>
      ) : null}
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
      onSubmit={(e) => {
        e.preventDefault();
        editor.submit();
      }}
    >
      <div {...stylex.props(subStyles.inlineRow)}>
        <div {...stylex.props(subStyles.formFieldGrow)}>
          <TextInput
            disabled={editor.isPending}
            error={editor.errors.keywords}
            label="Keywords"
            onChange={(e) => editor.setField("keywords", e.target.value)}
            value={editor.draft.keywords}
          />
        </div>
        <div {...stylex.props(subStyles.formFieldFixed)}>
          <TextInput
            disabled={editor.isPending}
            error={editor.errors.location}
            label="Location"
            onChange={(e) => editor.setField("location", e.target.value)}
            value={editor.draft.location}
          />
        </div>
        <div {...stylex.props(subStyles.formFieldFixed)}>
          <TextInput
            disabled={editor.isPending}
            error={editor.errors.retentionDays}
            label="Retention (days)"
            onChange={(e) => editor.setField("retentionDays", e.target.value)}
            value={editor.draft.retentionDays}
          />
        </div>
      </div>
      {editor.errorMessage ? (
        <div {...stylex.props(subStyles.errorGap)}>
          <ErrorNote>{editor.errorMessage}</ErrorNote>
        </div>
      ) : null}
      <div {...stylex.props(subStyles.inlineButtons)}>
        <Button disabled={editor.isPending} small type="submit">
          {editor.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          disabled={editor.isPending}
          onClick={onDone}
          small
          type="button"
          variant="subtle"
        >
          Cancel
        </Button>
      </div>
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
    <div>
      <p {...stylex.props(subStyles.summaryLine)}>
        `{sub.source}` {sub.keywords ?? "—"} · {sub.location ?? "—"} →{" "}
        {sub.scope === "dm" ? "your DMs" : `#${sub.channelId}`}
      </p>
      <p {...stylex.props(subStyles.sub)}>
        Past deliveries are deleted with it. This cannot be undone.
      </p>
      {remove.isError ? (
        <div {...stylex.props(subStyles.errorGap)}>
          <ErrorNote>{apiMessage(remove.error)}</ErrorNote>
        </div>
      ) : null}
      <div {...stylex.props(subStyles.inlineButtons)}>
        <Button
          disabled={remove.isPending}
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
      </div>
    </div>
  );
};

const SubscriptionRow = ({
  sub,
  open,
  setOpen,
}: {
  sub: SubscriptionDtoType;
  open: OpenPanel;
  setOpen: (open: OpenPanel) => void;
}) => {
  const update = useUpdateSubscription();
  const isOpen = open?.id === sub.id;

  return (
    <>
      <tr>
        <td {...stylex.props(subStyles.td)}>
          <Badge strong>{sub.source}</Badge>
        </td>
        <td {...stylex.props(subStyles.td)}>
          {sub.keywords ?? <span {...stylex.props(subStyles.muted)}>—</span>}
        </td>
        <td {...stylex.props(subStyles.td)}>
          {sub.location ?? <span {...stylex.props(subStyles.muted)}>—</span>}
        </td>
        <td {...stylex.props(subStyles.td)}>
          <Badge>{sub.scope === "dm" ? "DM" : "Guild"}</Badge>{" "}
          {sub.scope === "dm" ? (
            "Your DMs"
          ) : (
            <span {...stylex.props(subStyles.mono)} title={sub.channelId}>
              #{sub.channelId}
            </span>
          )}
          <br />
          <span {...stylex.props(subStyles.muted)}>
            {formatDate(sub.createdAt)}
          </span>
        </td>
        <td {...stylex.props(subStyles.td)}>
          <StatusDot
            label={sub.isActive ? "Active" : "Paused"}
            on={sub.isActive}
          />
        </td>
        <td {...stylex.props(subStyles.td)}>
          <div {...stylex.props(subStyles.actions)}>
            <Button
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  id: sub.id,
                  patch: { isActive: !sub.isActive },
                })
              }
              small
              variant="subtle"
            >
              {sub.isActive ? "Pause" : "Resume"}
            </Button>
            <Button
              onClick={() =>
                setOpen(
                  isOpen && open.mode === "edit"
                    ? null
                    : { id: sub.id, mode: "edit" }
                )
              }
              small
              variant="subtle"
            >
              Edit
            </Button>
            <Button
              onClick={() =>
                setOpen(
                  isOpen && open.mode === "delete"
                    ? null
                    : { id: sub.id, mode: "delete" }
                )
              }
              small
              variant="dangerSubtle"
            >
              Delete
            </Button>
          </div>
          {update.isError ? (
            <div {...stylex.props(subStyles.errorGap)}>
              <ErrorNote>{apiMessage(update.error)}</ErrorNote>
            </div>
          ) : null}
        </td>
      </tr>
      {isOpen ? (
        <tr>
          <td
            {...stylex.props(subStyles.td, subStyles.inlinePanel)}
            colSpan={6}
          >
            {open.mode === "edit" ? (
              <EditPanel onDone={() => setOpen(null)} sub={sub} />
            ) : (
              <DeletePanel onDone={() => setOpen(null)} sub={sub} />
            )}
          </td>
        </tr>
      ) : null}
    </>
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
  if (subs.length === 0) {
    return <EmptyList body={emptyBody} title={emptyTitle} />;
  }
  return (
    <div {...stylex.props(subStyles.tableScroll)}>
      <table {...stylex.props(subStyles.table)}>
        <thead>
          <tr>
            <th {...stylex.props(subStyles.th)} scope="col">
              Source
            </th>
            <th {...stylex.props(subStyles.th)} scope="col">
              Keywords
            </th>
            <th {...stylex.props(subStyles.th)} scope="col">
              Location
            </th>
            <th {...stylex.props(subStyles.th)} scope="col">
              Delivers to
            </th>
            <th {...stylex.props(subStyles.th)} scope="col">
              Status
            </th>
            <th {...stylex.props(subStyles.th)} scope="col">
              <span
                style={{
                  display: "inline-block",
                  width: "100%",
                  textAlign: "right",
                }}
              >
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {subs.map((sub) => (
            <SubscriptionRow
              key={sub.id}
              open={open}
              setOpen={setOpen}
              sub={sub}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
