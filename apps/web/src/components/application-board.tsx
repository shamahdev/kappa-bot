import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUSES,
  BOARD_STATUSES,
} from "@kappa/contracts";
import type {
  ApplicationDtoType,
  ApplicationStatusType,
} from "@kappa/contracts";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import type { DragEvent } from "react";

import {
  apiMessage,
  useApplications,
  useMoveApplication,
  useRemoveApplication,
} from "../lib/queries";
import { DashboardIcon } from "./dashboard-icon";
import { GradeBadge } from "./score";
import { formatDate } from "./subscriptions";
import { Button, EmptyList, LoadingNote, QueryError } from "./ui";

import "./application-board.css";

const DRAG_TYPE = "application/x-kappa-application";
const titleOf = (application: ApplicationDtoType) =>
  application.title ?? "Untitled posting";

const CardActions = ({ application }: { application: ApplicationDtoType }) => {
  const move = useMoveApplication();
  const remove = useRemoveApplication();
  const [confirming, setConfirming] = useState(false);
  const title = titleOf(application);
  if (confirming) {
    // Same pattern as CV removal: confirmation replaces the original controls.
    return (
      <div className="board-card-actions confirm">
        <span>Stop tracking?</span>
        <Button
          small
          variant="danger"
          loading={remove.isPending}
          onClick={() => remove.mutate(application.id)}
        >
          Remove
        </Button>
        <Button small variant="subtle" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        {remove.isError ? (
          <p className="board-card-error" role="alert">
            {apiMessage(remove.error)}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="board-card-actions">
      {/* Keyboard/touch alternative to dragging. */}
      <select
        aria-label={`Status for ${title}`}
        className="board-card-status"
        value={application.status}
        disabled={move.isPending}
        onChange={(event) =>
          move.mutate({
            id: application.id,
            status: event.target.value as ApplicationStatusType,
          })
        }
      >
        {APPLICATION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {APPLICATION_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="board-card-remove"
        aria-label={`Stop tracking ${title}`}
        onClick={() => setConfirming(true)}
      >
        <DashboardIcon name="trash" size={16} />
      </button>
      {move.isError ? (
        <p className="board-card-error" role="alert">
          {apiMessage(move.error)}
        </p>
      ) : null}
    </div>
  );
};

const ApplicationCard = ({
  application,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  application: ApplicationDtoType;
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) => (
  <div
    className={`board-card ${dragging ? "dragging" : ""}`}
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
  >
    <div className="board-card-head">
      <div className="board-card-title">
        <a href={application.url} rel="noopener noreferrer" target="_blank">
          {titleOf(application)}
        </a>
        <p>
          {[application.company, application.location]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      </div>
      {application.matchGrade ? (
        <GradeBadge grade={application.matchGrade} size="sm" />
      ) : null}
    </div>
    <div className="board-card-foot">
      <span className="app-badge">{application.source}</span>
      <span className="board-card-date">
        Updated {formatDate(application.updatedAt)}
      </span>
    </div>
    <CardActions application={application} />
  </div>
);

export const ApplicationBoard = () => {
  const applications = useApplications(true);
  const move = useMoveApplication();
  const tabsId = useId();
  const [showArchive, setShowArchive] = useState(false);
  const [mobileStatus, setMobileStatus] =
    useState<ApplicationStatusType>("applied");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<ApplicationStatusType | null>(
    null
  );

  if (applications.isPending) {
    return <LoadingNote>Loading your board…</LoadingNote>;
  }
  if (applications.isError) {
    return <QueryError error={applications.error} />;
  }
  const rows = applications.data;
  if (rows.length === 0) {
    return (
      <EmptyList
        title="Nothing tracked yet"
        body="Set a job to Bookmark or Applied from your job list, and it appears here."
        action={
          <Link className="app-button" to="/dashboard/jobs/list">
            Open job list
          </Link>
        }
      />
    );
  }

  const byStatus = (status: ApplicationStatusType) =>
    rows.filter((row) => row.status === status);
  const archived = byStatus("archive").length;
  const columns: readonly ApplicationStatusType[] = showArchive
    ? [...BOARD_STATUSES, "archive"]
    : BOARD_STATUSES;
  const visibleMobile = columns.includes(mobileStatus)
    ? mobileStatus
    : "applied";
  const failed = move.isError
    ? rows.find((row) => row.id === move.variables?.id)
    : undefined;

  const dropHandlers = (status: ApplicationStatusType) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setOverStatus(status);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOverStatus(null);
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setOverStatus(null);
      const id = Number(event.dataTransfer.getData(DRAG_TYPE));
      const card = rows.find((row) => row.id === id);
      if (card && card.status !== status) {
        move.mutate({ id, status });
      }
    },
  });

  const card = (application: ApplicationDtoType) => (
    <ApplicationCard
      key={application.id}
      application={application}
      dragging={draggingId === application.id}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, String(application.id));
        event.dataTransfer.effectAllowed = "move";
        setDraggingId(application.id);
      }}
      onDragEnd={() => {
        setDraggingId(null);
        setOverStatus(null);
      }}
    />
  );

  return (
    <div className="board">
      <div className="board-toolbar">
        <p className="app-muted">
          {rows.length - archived} active · {archived} archived
        </p>
        <Button
          small
          variant="subtle"
          onClick={() => setShowArchive((value) => !value)}
        >
          <DashboardIcon name="archive" size={16} />
          {showArchive ? "Hide archive" : `Show archive (${archived})`}
        </Button>
      </div>
      {failed ? (
        <div className="board-alert" role="alert">
          <p>
            Couldn’t move “{titleOf(failed)}” to{" "}
            {APPLICATION_STATUS_LABELS[move.variables?.status ?? "applied"]}. It
            stays in {APPLICATION_STATUS_LABELS[failed.status]}.{" "}
            {apiMessage(move.error)}
          </p>
          <Button small variant="subtle" onClick={() => move.reset()}>
            Dismiss
          </Button>
        </div>
      ) : null}
      {/* Phones show one column at a time; the strip is hidden on wider screens. */}
      <div aria-label="Board columns" className="board-tabs" role="tablist">
        {columns.map((status) => (
          <button
            aria-controls={`${tabsId}-${status}`}
            aria-selected={visibleMobile === status}
            className="board-tab"
            data-status={status}
            key={status}
            onClick={() => setMobileStatus(status)}
            role="tab"
            type="button"
          >
            <span aria-hidden="true" className="board-dot" />
            {APPLICATION_STATUS_LABELS[status]}
            <span className="board-count">{byStatus(status).length}</span>
          </button>
        ))}
      </div>
      <div className="board-columns">
        {columns.map((status) => {
          const cards = byStatus(status);
          return (
            <section
              key={status}
              id={`${tabsId}-${status}`}
              className={`board-column ${overStatus === status ? "over" : ""}`}
              data-mobile-active={visibleMobile === status}
              data-status={status}
              aria-label={`${APPLICATION_STATUS_LABELS[status]}, ${cards.length} jobs`}
              {...dropHandlers(status)}
            >
              <header className="board-column-head">
                <span className="board-dot" aria-hidden="true" />
                <h2>{APPLICATION_STATUS_LABELS[status]}</h2>
                <span className="board-count">{cards.length}</span>
              </header>
              <div className="board-column-body">
                {cards.length > 0 ? (
                  cards.map(card)
                ) : (
                  <p className="board-column-empty">
                    No jobs
                    <span className="board-drag-hint"> · drag one here</span>
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {showArchive ? null : (
        <div
          className={`board-archive-drop ${overStatus === "archive" ? "over" : ""}`}
          {...dropHandlers("archive")}
        >
          <DashboardIcon name="archive" size={18} />
          Drop here to archive
        </div>
      )}
    </div>
  );
};
