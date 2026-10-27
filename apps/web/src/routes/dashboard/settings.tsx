import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  BackLink,
  Button,
  ErrorNote,
  PageHeader,
  QueryError,
  SectionCard,
  TextInput,
} from "../../components/ui";
import {
  apiMessage,
  useAccountSummary,
  useDeleteAccount,
  useMe,
} from "../../lib/queries";

import styles from "./settings.module.css";

export const Route = createFileRoute("/dashboard/settings")({
  ssr: false,
  component: () => <SettingsComponent />,
});

const CONFIRM_PHRASE = "delete my account";

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

  if (me.isError) {
    return <QueryError error={me.error} />;
  }

  if (me.isPending || me.data === null) {
    return <Text color="secondary">Loading settings…</Text>;
  }

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;

  return (
    <VStack className={styles.settings} gap={4} maxWidth={640} width="100%">
      <BackLink label="← Back to dashboard" to="/dashboard" />
      <PageHeader
        description="Review your account details and deletion options."
        title="Settings"
      />
      <SectionCard title="Account">
        {summary.isPending ? (
          <Text color="secondary">Loading account summary…</Text>
        ) : null}
        {summary.isError ? (
          <ErrorNote>{apiMessage(summary.error)}</ErrorNote>
        ) : null}
        {summary.isSuccess ? (
          <VStack as="dl" className={styles.accountMetadata} gap={3}>
            <HStack gap={3} vAlign="start" wrap="wrap">
              <dt className={styles.metadataTerm}>
                <Text color="secondary" type="label">
                  Discord
                </Text>
              </dt>
              <dd className={styles.metadataValue}>
                <Text>@{summary.data.username}</Text>{" "}
                <Text color="secondary" type="code">
                  ({summary.data.discordId})
                </Text>
              </dd>
            </HStack>
            <HStack gap={3} vAlign="start" wrap="wrap">
              <dt className={styles.metadataTerm}>
                <Text color="secondary" type="label">
                  Connections
                </Text>
              </dt>
              <dd className={styles.metadataValue}>
                <Text>
                  {summary.data.connections.length > 0
                    ? summary.data.connections.join(", ")
                    : "none"}
                </Text>
              </dd>
            </HStack>
            <HStack gap={3} vAlign="start" wrap="wrap">
              <dt className={styles.metadataTerm}>
                <Text color="secondary" type="label">
                  DM subscriptions
                </Text>
              </dt>
              <dd className={styles.metadataValue}>
                <Text>{summary.data.dmSubscriptions}</Text>
              </dd>
            </HStack>
            <HStack gap={3} vAlign="start" wrap="wrap">
              <dt className={styles.metadataTerm}>
                <Text color="secondary" type="label">
                  Server subscriptions created
                </Text>
              </dt>
              <dd className={styles.metadataValue}>
                <Text>{summary.data.guildSubscriptionsCreated}</Text>
              </dd>
            </HStack>
            <HStack gap={3} vAlign="start" wrap="wrap">
              <dt className={styles.metadataTerm}>
                <Text color="secondary" type="label">
                  Active sessions
                </Text>
              </dt>
              <dd className={styles.metadataValue}>
                <Text>{summary.data.sessionsActive}</Text>
              </dd>
            </HStack>
          </VStack>
        ) : null}
      </SectionCard>

      <SectionCard title="Delete account" variant="muted">
        <VStack gap={3}>
          {summary.data ? (
            <Text as="p">
              Deletes your account (discord @{summary.data.username}),{" "}
              {summary.data.connections.length} connection
              {summary.data.connections.length === 1 ? "" : "s"} (
              {summary.data.connections.join(", ") || "none"}),{" "}
              {summary.data.dmSubscriptions} DM subscription
              {summary.data.dmSubscriptions === 1 ? "" : "s"}, their job
              history, and your CV. Server subscriptions remain with the server;
              your creator attribution is removed. Other users&apos; data is
              untouched. Irreversible.
            </Text>
          ) : (
            <Text as="p">
              Deletes your account, connections, DM subscriptions, their job
              history, and your CV. Server subscriptions remain with the server;
              your creator attribution is removed. Other users&apos; data is
              untouched. Irreversible.
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
            <VStack gap={3}>
              <TextInput
                autoComplete="off"
                disabled={destroy.isPending}
                label={`Type "${CONFIRM_PHRASE}" to confirm`}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                value={phrase}
              />
              {destroy.isError ? (
                <ErrorNote>{apiMessage(destroy.error)}</ErrorNote>
              ) : null}
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Button
                  disabled={!phraseOk || destroy.isPending}
                  loading={destroy.isPending}
                  type="submit"
                  variant="danger"
                >
                  {destroy.isPending ? "Deleting…" : "Delete my account"}
                </Button>
                <Link color="secondary" href="/dashboard">
                  Keep my account
                </Link>
              </HStack>
            </VStack>
          </form>
        </VStack>
      </SectionCard>
    </VStack>
  );
};
