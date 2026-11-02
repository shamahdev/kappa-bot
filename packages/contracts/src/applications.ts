import { Schema } from "effect";

import { MatchGrade } from "./matching";

// Requester-defined pipeline. "archive" is a hidden column on the board.
export const APPLICATION_STATUSES = [
  "bookmark",
  "applied",
  "interview",
  "offer",
  "rejected",
  "archive",
] as const;
export const ApplicationStatus = Schema.Literal(...APPLICATION_STATUSES);
export type ApplicationStatusType = typeof ApplicationStatus.Type;
export const BOARD_STATUSES = APPLICATION_STATUSES.filter(
  (status) => status !== "archive"
);
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatusType, string> =
  {
    applied: "Applied",
    archive: "Archive",
    bookmark: "Bookmark",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
  };

export const ApplicationDto = Schema.Struct({
  company: Schema.NullOr(Schema.String),
  // ISO 8601
  createdAt: Schema.String,
  id: Schema.Number,
  location: Schema.NullOr(Schema.String),
  matchGrade: Schema.NullOr(MatchGrade),
  source: Schema.String,
  status: ApplicationStatus,
  title: Schema.NullOr(Schema.String),
  updatedAt: Schema.String,
  url: Schema.String,
});
export type ApplicationDtoType = typeof ApplicationDto.Type;

export const ApplicationsResponse = Schema.Struct({
  applications: Schema.Array(ApplicationDto),
});

export const CreateApplicationBody = Schema.Struct({
  seenJobId: Schema.Number,
  status: ApplicationStatus,
});
export type CreateApplicationBodyType = typeof CreateApplicationBody.Type;

export const UpdateApplicationBody = Schema.Struct({
  status: ApplicationStatus,
});

/** Tracking state attached to a personal job row. */
export const JobApplicationRef = Schema.Struct({
  id: Schema.Number,
  status: ApplicationStatus,
});
