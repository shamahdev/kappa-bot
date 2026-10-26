import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  BackLink,
  Button,
  ErrorNote,
  PageHeader,
  SectionCard,
  TextInput,
} from "../../components/ui";
import {
  apiMessage,
  useAccountSummary,
  useDeleteAccount,
  useMe,
} from "../../lib/queries";
import { fonts, tokens } from "../../theme.stylex";

export const Route = createFileRoute("/dashboard/settings")({
  ssr: false,
  component: () => <SettingsComponent />,
});

const CONFIRM_PHRASE = "delete my account";

const page = stylex.create({
  dl: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    rowGap: 10,
    columnGap: 16,
    margin: 0,
  },
  dt: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: tokens.muted,
    lineHeight: "21px",
  },
  dd: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 600,
    color: tokens.ink,
    lineHeight: "21px",
    margin: 0,
  },
  mono: { fontFamily: fonts.mono, fontSize: 13, fontWeight: 400 },
  fieldGap: { marginTop: 4 },
  buttons: {
    display: "flex",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
    flexWrap: "wrap",
  },
  errorGap: { marginTop: 12 },
  constrain: { maxWidth: 640, width: "100%" },
});

const SettingsComponent = () => {
  const navigate = useNavigate();
  const me = useMe();
  const summary = useAccountSummary(Boolean(me.data));
  const destroy = useDeleteAccount();
  const [phrase, setPhrase] = useState("");

  useEffect(() => {
    if (me.data === null) {
      void navigate({ to: "/" });
    }
  }, [me.data, navigate]);

  if (me.isPending || me.data === null) {
    return <Text color="secondary">Loading settings…</Text>;
  }

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;

  return (
    <VStack gap={4}>
      <BackLink label="← Back to dashboard" to="/dashboard" />
      <PageHeader
        description="Your account, and the way out."
        title="Settings"
      />
      <div {...stylex.props(page.constrain)}>
        <VStack gap={4}>
          <SectionCard title="Account">
            {summary.isPending ? (
              <Text color="secondary">Loading account summary…</Text>
            ) : null}
            {summary.isError ? (
              <ErrorNote>{apiMessage(summary.error)}</ErrorNote>
            ) : null}
            {summary.isSuccess ? (
              <dl {...stylex.props(page.dl)}>
                <dt {...stylex.props(page.dt)}>Discord</dt>
                <dd {...stylex.props(page.dd)}>
                  @{summary.data.username}{" "}
                  <span
                    {...stylex.props(page.mono)}
                    title={summary.data.discordId}
                  >
                    ({summary.data.discordId})
                  </span>
                </dd>
                <dt {...stylex.props(page.dt)}>Connections</dt>
                <dd {...stylex.props(page.dd)}>
                  {summary.data.connections.length > 0
                    ? summary.data.connections.join(", ")
                    : "none"}
                </dd>
                <dt {...stylex.props(page.dt)}>DM subscriptions</dt>
                <dd {...stylex.props(page.dd)}>
                  {summary.data.dmSubscriptions}
                </dd>
                <dt {...stylex.props(page.dt)}>Server subscriptions created</dt>
                <dd {...stylex.props(page.dd)}>
                  {summary.data.guildSubscriptionsCreated}
                </dd>
                <dt {...stylex.props(page.dt)}>Active sessions</dt>
                <dd {...stylex.props(page.dd)}>
                  {summary.data.sessionsActive}
                </dd>
              </dl>
            ) : null}
          </SectionCard>

          <SectionCard title="Delete account" variant="muted">
            {summary.data ? (
              <Text>
                Deletes your account (discord @{summary.data.username}),{" "}
                {summary.data.connections.length} connection
                {summary.data.connections.length === 1 ? "" : "s"} (
                {summary.data.connections.join(", ") || "none"}),{" "}
                {summary.data.dmSubscriptions} DM subscription
                {summary.data.dmSubscriptions === 1 ? "" : "s"}, their job
                history, and your CV. Server subscriptions remain with the
                server; your creator attribution is removed. Other users&apos;
                data is untouched. Irreversible.
              </Text>
            ) : (
              <Text>
                Deletes your account, connections, DM subscriptions, their job
                history, and your CV. Server subscriptions remain with the
                server; your creator attribution is removed. Other users&apos;
                data is untouched. Irreversible.
              </Text>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!phraseOk || destroy.isPending) {
                  return;
                }
                destroy.reset();
                destroy.mutate(undefined, {
                  onSuccess: () => {
                    void navigate({ to: "/" });
                  },
                });
              }}
            >
              <div {...stylex.props(page.fieldGap)}>
                <TextInput
                  autoComplete="off"
                  disabled={destroy.isPending}
                  label={`Type "${CONFIRM_PHRASE}" to confirm`}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  value={phrase}
                />
              </div>
              {destroy.isError ? (
                <div {...stylex.props(page.errorGap)}>
                  <ErrorNote>{apiMessage(destroy.error)}</ErrorNote>
                </div>
              ) : null}
              <div {...stylex.props(page.buttons)}>
                <Button
                  disabled={!phraseOk || destroy.isPending}
                  type="submit"
                  variant="danger"
                >
                  {destroy.isPending ? "Deleting…" : "Delete my account"}
                </Button>
                <Link
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                  }}
                  to="/dashboard"
                >
                  Keep my account
                </Link>
              </div>
            </form>
          </SectionCard>
        </VStack>
      </div>
    </VStack>
  );
};
