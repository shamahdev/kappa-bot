import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
} from "@kappa/contracts";
import type { ApplicationStatusType } from "@kappa/contracts";

import { apiMessage, useTrackApplication } from "../lib/queries";
import { DashboardIcon } from "./dashboard-icon";

import styles from "./track-control.module.css";

const TRACK_FIRST: readonly ApplicationStatusType[] = ["bookmark", "applied"];

/**
 * One pill-shaped control per job: untracked jobs offer Bookmark/Applied,
 * tracked jobs any status. Used by the job list, Home and report pages.
 */
export const TrackControl = ({
  seenJobId,
  status,
  title,
}: {
  seenJobId: number;
  status: ApplicationStatusType | null;
  title: string;
}) => {
  const track = useTrackApplication();
  const options = status ? APPLICATION_STATUSES : TRACK_FIRST;
  return (
    <div className={styles.trackCell}>
      <div
        className={`${styles.trackControl} ${status ? "" : styles.untracked}`}
        data-status={status ?? "none"}
      >
        <span aria-hidden="true" className={styles.statusDot} />
        <select
          aria-label={`Tracking status for ${title}`}
          disabled={track.isPending}
          onChange={(event) => {
            const next = event.target.value as ApplicationStatusType;
            if (next && next !== status) {
              track.mutate({ seenJobId, status: next });
            }
          }}
          value={status ?? ""}
        >
          {status ? null : <option value="">Track job</option>}
          {options.map((value) => (
            <option key={value} value={value}>
              {APPLICATION_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <DashboardIcon name="chevronDown" size={14} />
      </div>
      {track.isError ? (
        <p className={styles.trackError} role="alert">
          {apiMessage(track.error)}
        </p>
      ) : null}
    </div>
  );
};
