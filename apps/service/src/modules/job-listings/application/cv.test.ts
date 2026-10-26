import { describe, expect, test } from "bun:test";

import {
  CV_MAX_CHARS,
  CV_MAX_FILENAME,
  CV_MAX_PDF_BYTES,
  CV_MIN_CHARS,
} from "@kappa/contracts";
import type { Database } from "@kappa/db";

import {
  CV_MAX_UPLOAD_BYTES,
  createCvProfiles,
  cvFilenameError,
  cvTextError,
} from "./cv";
import { testDatabase } from "./test-database";

const profile = {
  discordId: "alice",
  filename: "cv.txt",
  text: "a".repeat(CV_MIN_CHARS),
  updatedAt: new Date(),
};

describe("shared CV validation and persistence", () => {
  test("saves trimmed text and filename with the shared limits", async () => {
    const fake = testDatabase([], [profile]);
    const saved = await createCvProfiles(fake.db).save(
      "alice",
      `  ${profile.text}\n`,
      " cv.txt "
    );
    expect(saved).toEqual(profile);
    expect(fake.writes[0].values).toMatchObject({
      discordId: "alice",
      filename: "cv.txt",
      text: profile.text,
    });
    expect(cvTextError("a".repeat(CV_MIN_CHARS))).toBeNull();
    expect(cvTextError("a".repeat(CV_MAX_CHARS))).toBeNull();
  });
  test("rejects blank, too short, too long, and overlong filename before writes", async () => {
    const fake = testDatabase();
    const profiles = createCvProfiles(fake.db);
    for (const text of [
      "  ",
      "a".repeat(CV_MIN_CHARS - 1),
      "a".repeat(CV_MAX_CHARS + 1),
    ]) {
      // Validate sequentially against the shared write spy before asserting no writes.
      // oxlint-disable-next-line no-await-in-loop
      await expect(profiles.save("alice", text, null)).rejects.toMatchObject({
        code: "VALIDATION",
      });
    }
    await expect(
      profiles.save("alice", profile.text, "a".repeat(CV_MAX_FILENAME + 1))
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(fake.writes).toEqual([]);
  });
  test("filename helper shares supported attachment formats; pasted text can have no filename", async () => {
    for (const name of ["cv.PDF", "cv.txt", "cv.md"]) {
      expect(cvFilenameError(name)).toBeNull();
    }
    expect(cvFilenameError("cv.docx")).not.toBeNull();
    expect(
      cvFilenameError(`${"a".repeat(CV_MAX_FILENAME)}.pdf`)
    ).not.toBeNull();
    const fake = testDatabase([], [profile]);
    await createCvProfiles(fake.db).save("alice", profile.text, "  ");
    expect(fake.writes[0].values).toMatchObject({ filename: null });
  });
  test("PDF upload byte limit uses the shared constant and rejects before extraction or writes", async () => {
    expect(CV_MAX_UPLOAD_BYTES).toBe(CV_MAX_PDF_BYTES);
    const fake = testDatabase();
    await expect(
      createCvProfiles(fake.db).savePdf(
        "alice",
        new Uint8Array(CV_MAX_UPLOAD_BYTES + 1),
        "cv.pdf"
      )
    ).rejects.toMatchObject({
      code: "VALIDATION",
      message: "PDF must be 2MB or smaller",
    });
    expect(fake.writes).toEqual([]);
  });
  test("get and remove return saved/null and actual deletion outcome", async () => {
    const fake = testDatabase([[profile], []], [{ id: "alice" }]);
    const profiles = createCvProfiles(fake.db);
    expect(await profiles.get("alice")).toEqual(profile);
    expect(await profiles.get("bob")).toBeNull();
    expect(await profiles.remove("alice")).toBe(true);
    expect(await createCvProfiles(testDatabase().db).remove("alice")).toBe(
      false
    );
  });
});

describe("personal-only best-effort CV reads", () => {
  test("guild scope never reads a profile; DM scope resolves exactly its owner", async () => {
    const fake = testDatabase([[profile]]);
    const profiles = createCvProfiles(fake.db);
    expect(await profiles.textForScope("guild")).toBeNull();
    expect(await profiles.textForScope("dm:")).toBeNull();
    expect(fake.readCount).toBe(0);
    expect(await profiles.textForScope("dm:alice")).toBe(profile.text);
    expect(fake.readCount).toBe(1);
  });
  test("read failure cannot block delivery", async () => {
    const broken = {
      select() {
        throw new Error("offline DB");
      },
    } as unknown as Database;
    expect(await createCvProfiles(broken).textForScope("dm:alice")).toBeNull();
  });
});
