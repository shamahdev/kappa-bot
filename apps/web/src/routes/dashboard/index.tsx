import { createFileRoute, Link } from "@tanstack/react-router";

import { CvReportList } from "../../components/cv-reports";
import {
  Avatar,
  HStack,
  LoadingNote,
  PageHeader,
  QueryError,
  SectionCard,
  Text,
  VStack,
} from "../../components/ui";
import { guildIconUrl } from "../../lib/api";
import {
  useCv,
  useGuilds,
  useRequireAuth,
  useSubscriptions,
} from "../../lib/queries";

const DashboardHome = () => {
  const me = useRequireAuth();
  const guilds = useGuilds(Boolean(me.data));
  const subs = useSubscriptions(Boolean(me.data));
  const cv = useCv(Boolean(me.data));
  const personalSubs = subs.data?.filter((sub) => sub.scope === "dm") ?? [];
  const active = personalSubs.filter((sub) => sub.isActive).length;
  let cvStatus = "—";
  if (cv.isSuccess) {
    cvStatus = cv.data.hasCv ? "Uploaded" : "Not added";
  }
  return (
    <VStack gap={6}>
      <PageHeader
        title="Home"
        description={`Welcome back${me.data ? `, @${me.data.username}` : ""}. Your job search starts here.`}
      />
      <SectionCard title="CV reports">
        <CvReportList />
      </SectionCard>
      <div className="dashboard-home-overview">
        <SectionCard title="Your personal alerts">
          <Text as="p" color="secondary">
            Browse jobs delivered to your DMs, or fine-tune the subscriptions
            behind them.
          </Text>
          {subs.isError ? <QueryError error={subs.error} /> : null}
          {cv.isError ? <QueryError error={cv.error} /> : null}
          <div className="dashboard-home-summary">
            <div>
              <strong>{subs.isSuccess ? active : "—"}</strong>
              <span>Active subscriptions</span>
            </div>
            <div>
              <strong>{subs.isSuccess ? personalSubs.length : "—"}</strong>
              <span>Total subscriptions</span>
            </div>
            <div>
              <strong>{cvStatus}</strong>
              <span>Your CV</span>
            </div>
          </div>
          {subs.isPending || cv.isPending ? (
            <LoadingNote>Loading your overview…</LoadingNote>
          ) : null}
          <div className="dashboard-home-actions">
            <Link className="app-button" to="/dashboard/jobs">
              View jobs
            </Link>
            <Link className="app-button subtle" to="/dashboard/settings">
              Manage alerts
            </Link>
          </div>
        </SectionCard>
        <SectionCard title="Your Discord servers">
          <VStack gap={4}>
            <Text as="p" color="secondary">
              Jobs and settings for servers you manage.
            </Text>
            {guilds.isPending ? (
              <LoadingNote>Loading servers…</LoadingNote>
            ) : null}
            {guilds.isError ? <QueryError error={guilds.error} /> : null}
            {guilds.isSuccess && guilds.data.length === 0 ? (
              <Text as="p" color="secondary">
                No managed servers yet. Your personal alerts are ready to use.
              </Text>
            ) : null}
            <ul className="dashboard-home-server-list">
              {(guilds.data ?? []).map((guild) => (
                <li key={guild.id}>
                  <Link
                    to="/dashboard/servers/$guildId/jobs"
                    params={{ guildId: guild.id }}
                    className="app-scope-card"
                    aria-label={`Open ${guild.name} jobs`}
                  >
                    <HStack gap={3}>
                      <Avatar
                        name={guild.name}
                        src={guildIconUrl(guild.id, guild.icon) ?? undefined}
                      />
                      <VStack gap={1}>
                        <strong>{guild.name}</strong>
                        <small>
                          {guild.subscriptions.active} active,{" "}
                          {guild.subscriptions.total} total
                        </small>
                      </VStack>
                    </HStack>
                  </Link>
                </li>
              ))}
            </ul>
          </VStack>
        </SectionCard>
      </div>
    </VStack>
  );
};

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Home | Kappa" }] }),
  component: DashboardHome,
});
