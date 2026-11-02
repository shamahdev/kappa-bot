import { describe, expect, test } from "bun:test";

import { createJobApplications } from "./applications";
import { testDatabase } from "./test-database";

const now = new Date("2026-11-01T00:00:00Z");
const appRow = {
  company: "Co",
  createdAt: now,
  externalId: "ext-1",
  id: 5,
  location: "Remote",
  matchGrade: "B",
  seenJobId: 9,
  source: "linkedin",
  status: "applied",
  title: "Engineer",
  updatedAt: now,
  url: "https://example.com/1",
  userId: "u",
};

describe("personal application tracking", () => {
  test("cannot track a job outside the user's personal deliveries", async () => {
    const fake = testDatabase([[]]);
    await expect(
      createJobApplications(fake.db).track("u", 9, "applied")
    ).rejects.toThrow("job not found");
    expect(fake.writes).toHaveLength(0);
  });

  test("tracking snapshots the posting and grade so cards survive retention", async () => {
    const seen = {
      externalId: "ext-1",
      id: 9,
      matchScore: 67,
      snapshot: { company: "Co", location: "Remote", title: "Engineer" },
      source: "linkedin",
      url: "https://example.com/1",
    };
    const fake = testDatabase([[{ job: seen }]], [appRow]);
    const dto = await createJobApplications(fake.db).track("u", 9, "applied");
    expect(fake.writes[0]).toMatchObject({
      operation: "insert",
      table: "job_applications",
      values: {
        company: "Co",
        externalId: "ext-1",
        matchGrade: "B",
        seenJobId: 9,
        status: "applied",
        title: "Engineer",
        userId: "u",
      },
    });
    expect(dto).toMatchObject({ id: 5, matchGrade: "B", status: "applied" });
  });

  test("moving or removing another user's card finds nothing", async () => {
    const fake = testDatabase([], []);
    const apps = createJobApplications(fake.db);
    expect(await apps.move("u", 5, "offer")).toBe(null);
    expect(await apps.remove("u", 5)).toBe(false);
  });
});
