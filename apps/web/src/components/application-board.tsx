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
import { ArchiveIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import type { DragEvent } from "react";
import { toast } from "sonner";

import { fullDate, relativeDay } from "../lib/format";
import {
  apiMessage,
  useApplications,
  useMoveApplication,
  useRemoveApplication,
} from "../lib/queries";
import { GradeBadge } from "./score";
import { buttonVariants } from "./shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./shadcn/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "./shadcn/toggle-group";
import { Button, EmptyList, LoadingNote, QueryError } from "./ui";

import "./application-board.css";

const DRAG_TYPE = "application/x-kappa-application";
const titleOf = (application: ApplicationDtoType) =>
  application.title ?? "Untitled posting";

/**
 * Moves a card; archiving shows a toast whose Undo restores the previous
 * status (sonner's default toast duration).
 */
export const useBoardMove = () => {
  const move = useMoveApplication();
  const moveCard = (
    application: ApplicationDtoType,
    status: ApplicationStatusType
  ) => {
    if (application.status === status) {
      return;
    }
    const previous = application.status;
    move.mutate(
      { id: application.id, status },
      {
        onSuccess: () => {
          if (status !== "archive") {
            return;
          }
          toast(`Archived “${titleOf(application)}”`, {
            action: {
              label: "Undo",
              onClick: () =>
                move.mutate({ id: application.id, status: previous }),
            },
          });
        },
      }
    );
  };
  return { move, moveCard };
};

const CardMenu = ({
  application,
  onMove,
}: {
  application: ApplicationDtoType;
  onMove: (status: ApplicationStatusType) => void;
}) => {
  const remove = useRemoveApplication();
  const [confirming, setConfirming] = useState(false);
  const title = titleOf(application);
  if (confirming) {
    // Same pattern as CV removal: confirmation replaces the original control.
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
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Move ${title}`}
          className={buttonVariants({
            className: "board-card-move",
            size: "sm",
            variant: "subtle",
          })}
        >
          Move
          <ChevronDownIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          {APPLICATION_STATUSES.filter(
            (status) => status !== application.status
          ).map((status) => (
            <DropdownMenuItem key={status} onSelect={() => onMove(status)}>
              <span
                aria-hidden="true"
                className="board-dot"
                data-status={status}
              />
              {APPLICATION_STATUS_LABELS[status]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="board-menu-danger"
            onSelect={() => setConfirming(true)}
          >
            Stop tracking…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const ApplicationCard = ({
  application,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  application: ApplicationDtoType;
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onMove: (status: ApplicationStatusType) => void;
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
        <p className="board-card-date">
          {application.source} · updated{" "}
          <time
            dateTime={application.updatedAt}
            title={fullDate(application.updatedAt)}
          >
            {relativeDay(application.updatedAt)}
          </time>
        </p>
      </div>
      {application.matchGrade ? (
        <GradeBadge grade={application.matchGrade} size="sm" />
      ) : null}
    </div>
    <CardMenu application={application} onMove={onMove} />
  </div>
);

export const ApplicationBoard = () => {
  const applications = useApplications(true);
  const { move, moveCard } = useBoardMove();
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
          <Link className={buttonVariants()} to="/dashboard/jobs/list">
            Open job list
          </Link>
        }
      />
    );
  }

  const byStatus = (status: ApplicationStatusType) =>
    rows.filter((row) => row.status === status);
  const archivedCards = byStatus("archive");
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
      if (card) {
        moveCard(card, status);
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
      onMove={(status) => moveCard(application, status)}
    />
  );

  return (
    <div className="board">
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
      {/* Phones show one column at a time; hidden on wider screens. */}
      <ToggleGroup
        aria-label="Board column"
        className="board-tabs"
        onValueChange={(value) => {
          if (value) {
            setMobileStatus(value as ApplicationStatusType);
          }
        }}
        type="single"
        value={mobileStatus}
      >
        {BOARD_STATUSES.map((status) => (
          <ToggleGroupItem data-status={status} key={status} value={status}>
            <span aria-hidden="true" className="board-dot" />
            {APPLICATION_STATUS_LABELS[status]}
            <span className="board-count">{byStatus(status).length}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="board-columns">
        {BOARD_STATUSES.map((status) => {
          const cards = byStatus(status);
          return (
            <section
              key={status}
              className={`board-column ${overStatus === status ? "over" : ""}`}
              data-mobile-active={mobileStatus === status}
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
      <section
        aria-label={`Archive, ${archivedCards.length} jobs`}
        className={`board-archive ${overStatus === "archive" ? "over" : ""}`}
        data-status="archive"
        {...dropHandlers("archive")}
      >
        <div className="board-archive-bar">
          <ArchiveIcon aria-hidden="true" className="board-archive-icon" />
          <div className="board-archive-copy">
            <h2>Archive</h2>
            <p className="board-drag-hint">Drop a card here to archive it.</p>
          </div>
          <Button
            small
            variant="subtle"
            onClick={() => setShowArchive((value) => !value)}
          >
            {showArchive
              ? "Hide archive"
              : `Show archive (${archivedCards.length})`}
          </Button>
        </div>
        {showArchive ? (
          <div className="board-archive-cards">
            {archivedCards.length > 0 ? (
              archivedCards.map(card)
            ) : (
              <p className="board-column-empty">No archived jobs.</p>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
};
