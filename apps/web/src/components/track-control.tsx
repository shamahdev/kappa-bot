import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
} from "@kappa/contracts";
import type { ApplicationStatusType } from "@kappa/contracts";
import { ChevronDownIcon } from "lucide-react";

import { apiMessage, useTrackApplication } from "../lib/queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./shadcn/dropdown-menu";

import styles from "./track-control.module.css";

const TRACK_FIRST: readonly ApplicationStatusType[] = ["bookmark", "applied"];

/**
 * One pill-shaped menu per job (shadcn DropdownMenu): untracked jobs offer
 * Bookmark/Applied, tracked jobs any status. Job list, Home and report pages.
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
  const label = status ? APPLICATION_STATUS_LABELS[status] : "Track job";
  return (
    <div className={styles.trackCell}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Tracking status for ${title}: ${label}`}
          className={`${styles.trackControl} ${status ? "" : styles.untracked}`}
          data-status={status ?? "none"}
          disabled={track.isPending}
        >
          <span aria-hidden="true" className={styles.statusDot} />
          {label}
          <ChevronDownIcon aria-hidden="true" className={styles.chevron} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>
            {status ? "Move to" : "Track as"}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(next) => {
              if (next !== status) {
                track.mutate({
                  seenJobId,
                  status: next as ApplicationStatusType,
                });
              }
            }}
            value={status ?? ""}
          >
            {options.map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <span
                  aria-hidden="true"
                  className={styles.statusDot}
                  data-status={value}
                />
                {APPLICATION_STATUS_LABELS[value]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {track.isError ? (
        <p className={styles.trackError} role="alert">
          {apiMessage(track.error)}
        </p>
      ) : null}
    </div>
  );
};
