export const DEMO_JOBS = [
  {
    id: 1,
    title: "Backend engineer",
    company: "Example team",
    location: "Jakarta",
    source: "Kalibrr",
    summary: "Build APIs and work on the services behind a web application.",
  },
  {
    id: 2,
    title: "Product designer",
    company: "Example studio",
    location: "Remote",
    source: "Glints",
    summary:
      "Design product flows, test ideas and work closely with engineers.",
  },
  {
    id: 3,
    title: "Frontend engineer",
    company: "Example company",
    location: "Jakarta",
    source: "Jobstreet",
    summary:
      "Build accessible interfaces and improve the experience across devices.",
  },
] as const;

export const resolveDemoReply = (reply: string) =>
  DEMO_JOBS.find((job) => String(job.id) === reply.trim());
export type DemoJob = (typeof DEMO_JOBS)[number];
