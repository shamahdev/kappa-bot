import { Avatar } from "@astryxdesign/core/Avatar";
import { Banner } from "@astryxdesign/core/Banner";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Layout";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Badge, Button, StatusDot, Tabs, TextInput } from "./ui";

interface DemoJob {
  id: string;
  title: string;
  company: string;
  location: string;
  posted: string;
  salary: string;
  score: number;
  reason: string;
  skills: string[];
  source: string;
  url: string;
  fresh?: boolean;
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
    skills: ["Product strategy", "Figma", "Design systems"],
    source: "LinkedIn",
    url: "https://www.linkedin.com/jobs/view/linear-staff-product-designer",
    fresh: true,
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
    skills: ["User research", "Fintech", "Prototyping"],
    source: "LinkedIn",
    url: "https://www.linkedin.com/jobs/view/wise-senior-product-designer",
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
    skills: ["Remote work", "B2B SaaS", "Interaction"],
    source: "Glints",
    url: "https://www.glints.com/jobs/product-designer-deel",
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
    skills: ["Growth", "Experimentation", "Leadership"],
    source: "Indeed",
    url: "https://uk.indeed.com/viewjob?jk=monzo-design-lead",
  },
];

const PROFILE = {
  name: "Mara Chen",
  role: "Senior product designer",
  location: "Berlin, Germany",
  cvName: "mara-chen-product-design.pdf",
  cvUpdated: "Updated 2 days ago",
  activeAlerts: 4,
  newToday: 12,
  averageMatch: 86,
};

const DISCORD_CHANNEL = {
  guild: "Mara’s job search",
  channel: "design-leads",
  time: "Today at 09:42",
};

const FILTERS = [
  { value: "for-you", label: "For you" },
  { value: "new", label: "New today" },
  { value: "saved", label: "Saved" },
];

const JobRow = ({
  job,
  saved,
  expanded,
  onSave,
  onExplain,
}: {
  job: DemoJob;
  saved: boolean;
  expanded: boolean;
  onSave: () => void;
  onExplain: () => void;
}) => (
  <VStack gap={3}>
    <HStack gap={3} vAlign="center">
      <Avatar name={job.company} size="md" />
      <VStack gap={0}>
        <HStack gap={2} vAlign="center">
          <a
            href={job.url}
            rel="noreferrer"
            style={{
              fontWeight: 700,
              color: "var(--color-text-primary)",
              textDecoration: "none",
            }}
            target="_blank"
          >
            {job.title}
          </a>
          {job.fresh ? <Badge strong>New</Badge> : null}
        </HStack>
        <Text color="secondary" type="supporting">
          {job.company} · {job.location} · {job.posted} · {job.salary}
        </Text>
      </VStack>
    </HStack>
    <HStack gap={2} vAlign="center">
      <Text weight="bold">{job.score}% match</Text>
      <Badge>{job.source}</Badge>
      <Button onClick={onExplain} small variant="subtle">
        {expanded ? "Hide reason" : "Why this match"}
      </Button>
      <Button onClick={onSave} small variant="subtle">
        {saved ? "Saved" : "Save"}
      </Button>
    </HStack>
    {expanded ? (
      <Card padding={3} variant="muted">
        <VStack gap={2}>
          <Text type="supporting">{job.reason}</Text>
          <HStack gap={2}>
            {job.skills.map((skill) => (
              <Badge key={skill}>{skill}</Badge>
            ))}
          </HStack>
        </VStack>
      </Card>
    ) : null}
    <Divider />
  </VStack>
);

const DiscordPreview = ({
  job,
  delivered,
  onDeliver,
}: {
  job: DemoJob;
  delivered: boolean;
  onDeliver: () => void;
}) => (
  <Card padding={4}>
    <VStack gap={4}>
      <HStack gap={2} vAlign="center">
        <Heading level={2}>Discord message</Heading>
        <StatusDot label={delivered ? "Delivered" : "Ready"} on={delivered} />
      </HStack>
      <Text color="secondary" type="supporting">
        #{DISCORD_CHANNEL.channel} · {DISCORD_CHANNEL.guild} ·{" "}
        {DISCORD_CHANNEL.time}
      </Text>
      <Card padding={3} variant="muted">
        <VStack gap={2}>
          <HStack gap={2} vAlign="center">
            <Avatar name="Kappa" size="sm" />
            <Text weight="bold">
              {job.title} @ {job.company}
            </Text>
            <Text weight="bold">{job.score}%</Text>
          </HStack>
          <Text type="supporting">{job.reason}</Text>
          <Text color="secondary" type="supporting">
            {job.location} · {job.salary} · {job.posted} · {job.source}
          </Text>
        </VStack>
      </Card>
      <Button
        onClick={onDeliver}
        small
        variant={delivered ? "subtle" : "brand"}
      >
        {delivered ? "Delivered" : "Deliver to Discord"}
      </Button>
    </VStack>
  </Card>
);

export const LandingDemo = ({ authAction }: { authAction: ReactNode }) => {
  const [filter, setFilter] = useState("for-you");
  const [query, setQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([
    "wise-senior-product-designer",
  ]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [delivered, setDelivered] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const visibleJobs = useMemo(() => {
    let jobs = DEMO_JOBS;
    if (filter === "new") {
      jobs = jobs.slice(0, 3);
    }
    if (filter === "saved") {
      jobs = jobs.filter((job) => savedIds.includes(job.id));
    }
    const value = query.trim().toLowerCase();
    if (value) {
      jobs = jobs.filter((job) =>
        `${job.title} ${job.company} ${job.location}`
          .toLowerCase()
          .includes(value)
      );
    }
    return jobs;
  }, [filter, query, savedIds]);

  return (
    <VStack gap={10}>
      <Text color="secondary" type="supporting">
        Preview workspace · sample data
      </Text>

      {/* Centered Hero (template: centered-hero) */}
      <VStack gap={6} hAlign="center">
        <VStack gap={3} hAlign="center">
          <Heading
            justify="center"
            level={1}
            textWrap="balance"
            type="display-2"
          >
            See only roles that match your CV.
          </Heading>
          <Text
            color="secondary"
            justify="center"
            textWrap="balance"
            type="body"
          >
            Kappa reads your CV, ranks fresh JobPostings against it, and sends
            the strongest matches to Discord.
          </Text>
        </VStack>
        <HStack gap={3} vAlign="center">
          <Button
            onClick={() =>
              feedRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            }
          >
            {`Review ${PROFILE.newToday} matches`}
          </Button>
          {authAction}
        </HStack>
        <Text color="secondary" justify="center" type="supporting">
          Private by default, with a reason on every match and no duplicate
          posts.
        </Text>
      </VStack>

      {/* Match profile */}
      <Card padding={4}>
        <VStack gap={3}>
          <HStack gap={2} vAlign="center">
            <Heading level={3}>{PROFILE.name}</Heading>
            <StatusDot label="CV ready" on />
          </HStack>
          <Text color="secondary" type="supporting">
            {PROFILE.role} · {PROFILE.location}
          </Text>
          <ProgressBar
            label="Average CV match"
            max={100}
            value={PROFILE.averageMatch}
          />
          <Text color="secondary" type="supporting">
            {PROFILE.cvName} · {PROFILE.cvUpdated}
          </Text>
          <Text color="secondary" type="supporting">
            {PROFILE.activeAlerts} active alerts
          </Text>
        </VStack>
      </Card>

      {/* Workspace: library Card Grid + delivery */}
      <div ref={feedRef}>
        <Grid columns={{ minWidth: 340 }} gap={4}>
          <Card padding={4}>
            <VStack gap={4}>
              <Heading level={2}>Today’s sample matches</Heading>
              <Tabs onChange={setFilter} tabs={FILTERS} value={filter} />
              <TextInput
                label="Search"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or company"
                value={query}
              />
              <Banner
                status="info"
                title="Scores combine role requirements with your CV. Every result keeps a short, editable reason."
              />
              {visibleJobs.length > 0 ? (
                <VStack gap={4}>
                  {visibleJobs.map((job) => (
                    <JobRow
                      expanded={expandedId === job.id}
                      job={job}
                      key={job.id}
                      onExplain={() =>
                        setExpandedId(expandedId === job.id ? null : job.id)
                      }
                      onSave={() =>
                        setSavedIds((current) =>
                          current.includes(job.id)
                            ? current.filter((id) => id !== job.id)
                            : [...current, job.id]
                        )
                      }
                      saved={savedIds.includes(job.id)}
                    />
                  ))}
                </VStack>
              ) : (
                <EmptyState
                  description={
                    filter === "saved"
                      ? "Save a role to keep it in this view."
                      : "Try another search or filter."
                  }
                  title={
                    filter === "saved" ? "No saved matches" : "No matches found"
                  }
                />
              )}
            </VStack>
          </Card>
          <DiscordPreview
            delivered={delivered}
            job={DEMO_JOBS[0]}
            onDeliver={() => setDelivered((v) => !v)}
          />
        </Grid>
      </div>

      {/* How it works */}
      <VStack gap={4}>
        <Heading level={2}>
          Set your filter once, then review only the matches.
        </Heading>
        <Grid columns={3} gap={4}>
          <Card padding={4}>
            <VStack gap={2}>
              <Text color="secondary" type="supporting">
                01
              </Text>
              <Heading level={3}>Parse your CV</Heading>
              <Text color="secondary" type="supporting">
                Extract role, skills, and experience signals.
              </Text>
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={2}>
              <Text color="secondary" type="supporting">
                02
              </Text>
              <Heading level={3}>Rank new roles</Heading>
              <Text color="secondary" type="supporting">
                Score each fresh JobPosting against your profile.
              </Text>
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={2}>
              <Text color="secondary" type="supporting">
                03
              </Text>
              <Heading level={3}>Deliver to Discord</Heading>
              <Text color="secondary" type="supporting">
                Post the match with its reason and summary.
              </Text>
            </VStack>
          </Card>
        </Grid>
      </VStack>
    </VStack>
  );
};
