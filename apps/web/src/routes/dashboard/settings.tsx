import {
  createFileRoute,
  Link as RouterLink,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  Button,
  ErrorNote,
  HStack,
  LoadingNote,
  PageHeader,
  QueryError,
  SectionCard,
  Text,
  TextInput,
  VStack,
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
  head: () => ({ meta: [{ title: "Settings | Kappa" }] }),
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
    return <LoadingNote>Loading settings…</LoadingNote>;
  }

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;

  return (
    <VStack className={styles.settings} gap={6} width="100%">
      <PageHeader
        description="Review your account details and deletion options."
        title="Settings"
      />
      <div className={styles.panels}>
        <SectionCard title="Account">
          {summary.isPending ? (
            <LoadingNote>Loading account summary…</LoadingNote>
          ) : null}
          {summary.isError ? (
            <ErrorNote>{apiMessage(summary.error)}</ErrorNote>
          ) : null}
          {summary.isSuccess ? (
            <dl className={`app-account-metadata ${styles.accountMetadata}`}>
              <div>
                <dt className={styles.metadataTerm}>
                  <Text color="secondary" type="label">
                    Discord
                  </Text>
                </dt>
                <dd className={styles.metadataValue}>
                  <Text>@{summary.data.username}</Text>
                  <Text color="secondary" type="code">
                    {summary.data.discordId}
                  </Text>
                </dd>
              </div>
              <div>
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
              </div>
              <div>
                <dt className={styles.metadataTerm}>
                  <Text color="secondary" type="label">
                    DM subscriptions
                  </Text>
                </dt>
                <dd className={styles.metadataValue}>
                  <Text>{summary.data.dmSubscriptions}</Text>
                </dd>
              </div>
              <div>
                <dt className={styles.metadataTerm}>
                  <Text color="secondary" type="label">
                    Server subscriptions created
                  </Text>
                </dt>
                <dd className={styles.metadataValue}>
                  <Text>{summary.data.guildSubscriptionsCreated}</Text>
                </dd>
              </div>
              <div>
                <dt className={styles.metadataTerm}>
                  <Text color="secondary" type="label">
                    Active sessions
                  </Text>
                </dt>
                <dd className={styles.metadataValue}>
                  <Text>{summary.data.sessionsActive}</Text>
                </dd>
              </div>
            </dl>
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
                history, and your CV. Server subscriptions remain with the
                server; your creator attribution is removed. Other users&apos;
                data is untouched. Irreversible.
              </Text>
            ) : (
              <Text as="p">
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
                  <RouterLink className="app-back" to="/dashboard">
                    Keep my account
                  </RouterLink>
                </HStack>
              </VStack>
            </form>
          </VStack>
        </SectionCard>
      </div>
    </VStack>
  );
};
