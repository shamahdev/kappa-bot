import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { Selector } from "@astryxdesign/core/Selector";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { pixel, proportional, Table } from "@astryxdesign/core/Table";
import type { TableColumn } from "@astryxdesign/core/Table";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import styles from "./landing-demo.module.css";

interface DemoJob extends Record<string, unknown> {
  id: string;
  title: string;
  company: string;
  location: string;
  posted: string;
  salary: string;
  score: number;
  reason: string;
  description: string;
  source: string;
}

const DEMO_JOBS: DemoJob[] = [
  {
    id: "linear-staff-product-designer",
    title: "Staff Product Designer",
    company: "Linear",
    location: "Remote · EU time zones",
    posted: "2h ago",
    salary: "€95k–€125k",
    score: 94,
    reason: "Your product systems experience maps directly to this role.",
    description:
      "Help shape thoughtful tools for software teams. Work across product strategy, interaction design, and design systems with a small, collaborative team.",
    source: "LinkedIn",
  },
  {
    id: "wise-senior-product-designer",
    title: "Senior Product Designer",
    company: "Wise",
    location: "Amsterdam · Hybrid",
    posted: "5h ago",
    salary: "€88k–€112k",
    score: 87,
    reason:
      "Strong overlap in research, systems thinking, and cross-functional work.",
    description:
      "Make international money movement simpler. Partner with research and engineering to turn complex financial workflows into clear product experiences.",
    source: "LinkedIn",
  },
  {
    id: "deel-product-designer",
    title: "Product Designer",
    company: "Deel",
    location: "Remote · Worldwide",
    posted: "Yesterday",
    salary: "$120k–$155k",
    score: 81,
    reason: "A good fit for your remote-first and product-led experience.",
    description:
      "Design tools that help distributed teams work together. Own end-to-end experiences across a growing B2B product, from discovery through delivery.",
    source: "Glints",
  },
  {
    id: "monzo-design-lead",
    title: "Design Lead, Growth",
    company: "Monzo",
    location: "London · Hybrid",
    posted: "2d ago",
    salary: "£105k–£130k",
    score: 76,
    reason:
      "Your growth experimentation background is a useful differentiator.",
    description:
      "Lead a team exploring better everyday banking. Combine product craft, experimentation, and coaching to help more people discover useful financial tools.",
    source: "Indeed",
  },
];

interface DemoSubscription extends Record<string, unknown> {
  id: string;
  source: string;
  keywords: string;
  location: string;
  isActive: boolean;
}

const DEMO_SUBSCRIPTIONS: DemoSubscription[] = [
  {
    id: "linkedin",
    source: "LinkedIn",
    keywords: "product designer",
    location: "Remote / Europe",
    isActive: true,
  },
  {
    id: "glints",
    source: "Glints",
    keywords: "product designer",
    location: "Remote",
    isActive: true,
  },
  {
    id: "indeed",
    source: "Indeed",
    keywords: "design lead",
    location: "London",
    isActive: false,
  },
];

const HashIcon = () => (
  <svg aria-hidden="true" className={styles.hashIcon} viewBox="0 0 24 24">
    <path
      d="M9 3 6 21M18 3l-3 18M3 9h18M2 15h18"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  </svg>
);

const DiscordMessage = ({
  children,
  time,
}: {
  children: ReactNode;
  time: string;
}) => (
  <article aria-label={`Kappa message, ${time}`} className={styles.message}>
    <div aria-hidden="true" className={styles.botAvatar}>
      K
    </div>
    <div className={styles.messageBody}>
      <div className={styles.messageAuthor}>
        <span className={styles.authorName}>Kappa</span>
        <span className={styles.appTag}>APP</span>
        <span className={styles.timestamp}>{time}</span>
      </div>
      {children}
    </div>
  </article>
);

/** A visual mock of Discord, not a connection to Discord or a message composer. */
const DiscordPreview = ({ job }: { job: DemoJob }) => {
  const sourceJobs = DEMO_JOBS.filter((item) => item.source === job.source);
  const replyNumber = sourceJobs.findIndex((item) => item.id === job.id) + 1;
  const keyword = job.source === "Indeed" ? "design lead" : "product designer";

  return (
    <div className={styles.discordApp}>
      <aside aria-label="Sample Discord servers" className={styles.serverRail}>
        <div className={styles.homeMark}>
          <svg aria-hidden="true" height="22" viewBox="0 0 24 24" width="22">
            <path
              d="m3 10 9-7 9 7v10h-6v-6H9v6H3Z"
              fill="none"
              stroke="currentColor"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        </div>
        <div className={styles.railDivider} />
        <div aria-label="Mara’s job search" className={styles.serverMark}>
          M
        </div>
      </aside>
      <aside
        aria-label="Sample Discord channels"
        className={styles.channelSidebar}
      >
        <div className={styles.serverHeading}>Mara’s job search</div>
        <div className={styles.channelList}>
          <div className={styles.channelCategory}>⌄ &nbsp; TEXT CHANNELS</div>
          <div className={styles.channelMuted}>
            <HashIcon /> general
          </div>
          <div className={styles.channelSelected}>
            <HashIcon /> job-alerts
          </div>
        </div>
        <div className={styles.userBar}>
          <div aria-hidden="true" className={styles.userAvatar}>
            M
          </div>
          <div>
            <div className={styles.userName}>Mara</div>
            <div className={styles.userStatus}>Online</div>
          </div>
        </div>
      </aside>
      <div className={styles.conversation}>
        <div className={styles.channelHeader}>
          <HashIcon />
          <span className={styles.channelName}>job-alerts</span>
          <span className={styles.channelTopic}>
            Your next role, minus the noise.
          </span>
        </div>
        <div
          aria-label="Sample Discord conversation"
          className={styles.messageList}
        >
          <div className={styles.dateDivider}>Today</div>
          <DiscordMessage time="Today at 09:42">
            <div className={styles.embed}>
              <div className={styles.embedHeading}>
                {sourceJobs.length} new ‘{keyword}’{" "}
                {sourceJobs.length === 1 ? "job" : "jobs"} found in {job.source}
              </div>
              <ol className={styles.deliveryList}>
                {sourceJobs.map((item) => (
                  <li key={item.id}>
                    <span className={styles.discordLink}>
                      {item.title} @ {item.company}
                    </span>
                  </li>
                ))}
              </ol>
              <div className={styles.embedFooter}>
                Reply with{" "}
                {sourceJobs.length === 1 ? "1" : `1–${sourceJobs.length}`} to
                get the summary of the job
              </div>
            </div>
          </DiscordMessage>
          <article aria-label="Mara’s sample reply" className={styles.message}>
            <div aria-hidden="true" className={styles.userAvatar}>
              M
            </div>
            <div className={styles.messageBody}>
              <div className={styles.messageAuthor}>
                <span className={styles.authorName}>Mara</span>
                <span className={styles.timestamp}>Today at 09:43</span>
              </div>
              <p className={styles.reply}>{replyNumber}</p>
            </div>
          </article>
          <DiscordMessage time="Today at 09:43">
            <div className={styles.embed}>
              <div className={styles.discordLink}>
                <strong>
                  {job.title} @ {job.company}
                </strong>
              </div>
              <p className={styles.embedDescription}>{job.description}</p>
              <dl className={styles.embedFields}>
                <div>
                  <dt>Location</dt>
                  <dd>{job.location}</dd>
                </div>
                <div>
                  <dt>Posted</dt>
                  <dd>{job.posted}</dd>
                </div>
                <div>
                  <dt>Salary</dt>
                  <dd>{job.salary}</dd>
                </div>
              </dl>
              <div className={styles.matchField}>
                <strong>Match</strong>
                <p>
                  {job.score}% — {job.reason}
                </p>
              </div>
              <div className={styles.embedFooter}>
                ‘{keyword}’ keyword in ‘{job.source}’
              </div>
            </div>
          </DiscordMessage>
        </div>
        <div className={styles.composerPreview}>
          <span aria-hidden="true" className={styles.composerPlus}>
            +
          </span>
          <span>Message #job-alerts</span>
          <span className={styles.readOnlyLabel}>Preview only</span>
        </div>
      </div>
    </div>
  );
};

const DashboardPreview = ({
  selectedJob,
  onSelectJob,
}: {
  selectedJob: DemoJob;
  onSelectJob: (job: DemoJob) => void;
}) => {
  const id = useId();
  const [tab, setTab] = useState("jobs");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All sources");
  const [subscriptions, setSubscriptions] = useState(DEMO_SUBSCRIPTIONS);
  const term = query.trim().toLowerCase();
  const visibleJobs = DEMO_JOBS.filter(
    (job) =>
      (source === "All sources" || job.source === source) &&
      `${job.title} ${job.company} ${job.location}`.toLowerCase().includes(term)
  );

  const jobColumns: TableColumn<DemoJob>[] = [
    {
      key: "title",
      header: "Job",
      width: proportional(2),
      renderCell: (job) => (
        <VStack gap={1}>
          <Text weight="semibold">{job.title}</Text>
          <Text color="secondary" type="supporting">
            {job.company} · {job.location}
          </Text>
          <Text color="secondary" type="supporting">
            {job.source} · {job.posted}
          </Text>
        </VStack>
      ),
    },
    {
      key: "score",
      header: "Match",
      width: pixel(88),
      renderCell: (job) => <Text weight="semibold">{job.score}%</Text>,
    },
    {
      key: "preview",
      header: "Discord",
      width: pixel(100),
      renderCell: (job) => (
        <Button
          aria-label={`Preview ${job.title} in Discord`}
          aria-pressed={selectedJob.id === job.id}
          label={selectedJob.id === job.id ? "Selected" : "Preview"}
          onClick={() => onSelectJob(job)}
          size="sm"
          variant="secondary"
        />
      ),
    },
  ];

  const subscriptionColumns: TableColumn<DemoSubscription>[] = [
    {
      key: "keywords",
      header: "Subscription",
      width: proportional(2),
      renderCell: (sub) => (
        <VStack gap={1}>
          <Text weight="semibold">{sub.keywords}</Text>
          <Text color="secondary" type="supporting">
            {sub.source} · {sub.location}
          </Text>
          <Text color="secondary" type="supporting">
            Delivered to your DMs
          </Text>
        </VStack>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      width: pixel(88),
      renderCell: (sub) => (
        <HStack gap={1} vAlign="center" wrap="wrap">
          <StatusDot
            label={sub.isActive ? "Active" : "Paused"}
            variant={sub.isActive ? "success" : "neutral"}
          />
          <Text type="supporting">{sub.isActive ? "Active" : "Paused"}</Text>
        </HStack>
      ),
    },
    {
      key: "action",
      header: "Manage",
      width: pixel(100),
      renderCell: (sub) => (
        <Button
          aria-label={`${sub.isActive ? "Pause" : "Resume"} ${sub.source} sample subscription`}
          label={sub.isActive ? "Pause" : "Resume"}
          onClick={() =>
            setSubscriptions((current) =>
              current.map((item) =>
                item.id === sub.id
                  ? { ...item, isActive: !item.isActive }
                  : item
              )
            )
          }
          size="sm"
          variant="secondary"
        />
      ),
    },
  ];

  return (
    <div className={styles.dashboardApp}>
      <div className={styles.dashboardTopbar}>
        <Text weight="bold">Kappa</Text>
        <Badge label="Sample workspace" variant="neutral" />
      </div>
      <div className={styles.dashboardHeading}>
        <div>
          <Heading level={3}>Direct messages</Heading>
          <Text color="secondary" type="supporting">
            Jobs, subscriptions, and CV matching.
          </Text>
        </div>
        <div className={styles.profileStatus}>
          <StatusDot label="CV ready" variant="success" />
          <Text type="supporting">CV ready</Text>
        </div>
      </div>
      <div className={styles.tabBar}>
        <TabList
          aria-label="Demo dashboard views"
          hasDivider
          onChange={setTab}
          role="tablist"
          value={tab}
        >
          <Tab
            id={`${id}-jobs-tab`}
            label="Jobs"
            panelId={`${id}-jobs`}
            value="jobs"
          />
          <Tab
            id={`${id}-subscriptions-tab`}
            label="Subscriptions"
            panelId={`${id}-subscriptions`}
            value="subscriptions"
          />
        </TabList>
      </div>
      <div
        aria-labelledby={`${id}-jobs-tab`}
        hidden={tab !== "jobs"}
        id={`${id}-jobs`}
        role="tabpanel"
      >
        <div className={styles.filters}>
          <TextInput
            label="Search jobs"
            onChange={setQuery}
            placeholder="Title, company, or location"
            value={query}
          />
          <Selector
            label="Source"
            onChange={setSource}
            options={["All sources", "LinkedIn", "Glints", "Indeed"]}
            value={source}
            width="100%"
          />
        </div>
        <Table
          aria-label="Sample delivered jobs"
          columns={jobColumns}
          data={visibleJobs}
          density="balanced"
          dividers="rows"
          emptyState={
            <EmptyState
              actions={
                <Button
                  label="Clear filters"
                  onClick={() => {
                    setQuery("");
                    setSource("All sources");
                  }}
                  variant="secondary"
                />
              }
              description="Try a different title, company, or source."
              title="No sample jobs match"
            />
          }
          hasHover
          idKey="id"
          verticalAlign="top"
        />
        <div aria-live="polite" className={styles.dashboardFooter}>
          <Text color="secondary" type="supporting">
            {visibleJobs.length} of {DEMO_JOBS.length} sample jobs
          </Text>
          <a className={styles.previewLink} href="#discord-preview">
            See the selected job in Discord ↓
          </a>
        </div>
      </div>
      <div
        aria-labelledby={`${id}-subscriptions-tab`}
        hidden={tab !== "subscriptions"}
        id={`${id}-subscriptions`}
        role="tabpanel"
      >
        <div className={styles.subscriptionNote}>
          <Text color="secondary" type="supporting">
            Try pausing an alert. Changes stay in this demo.
          </Text>
        </div>
        <Table
          aria-label="Sample subscriptions"
          columns={subscriptionColumns}
          data={subscriptions}
          density="balanced"
          dividers="rows"
          idKey="id"
          verticalAlign="top"
        />
      </div>
    </div>
  );
};

export const LandingDemo = ({ authAction }: { authAction: ReactNode }) => {
  const [selectedJob, setSelectedJob] = useState(DEMO_JOBS[0]);

  return (
    <VStack gap={8}>
      <div className={styles.intro}>
        <div>
          <Heading level={1} textWrap="balance">
            Your job search, in two views.
          </Heading>
          <Text color="secondary">
            Explore the dashboard. See how the same jobs arrive in Discord.
          </Text>
        </div>
        <div className={styles.authAction}>{authAction}</div>
      </div>
      <section aria-labelledby="dashboard-preview-heading">
        <div className={styles.sectionHeading}>
          <Heading id="dashboard-preview-heading" level={2}>
            The dashboard
          </Heading>
          <Text color="secondary" type="supporting">
            Search the table, manage sample subscriptions, and pick a job to
            preview below.
          </Text>
        </div>
        <DashboardPreview
          onSelectJob={setSelectedJob}
          selectedJob={selectedJob}
        />
      </section>
      <section
        aria-labelledby="discord-preview-heading"
        className={styles.discordSection}
        id="discord-preview"
      >
        <div className={styles.sectionHeading}>
          <Heading id="discord-preview-heading" level={2}>
            In Discord
          </Heading>
          <Text color="secondary" type="supporting">
            A job list, a numbered reply, and the full job card. This is sample
            data, not a live channel.
          </Text>
        </div>
        <DiscordPreview job={selectedJob} />
      </section>
    </VStack>
  );
};
