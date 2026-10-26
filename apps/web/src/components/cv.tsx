import { CV_MAX_CHARS, CV_MIN_CHARS } from "@kappa/contracts";
import * as stylex from "@stylexjs/stylex";

import { useCv } from "../lib/queries";
import type { CvDtoType } from "../lib/queries";
import { useCvEditor } from "../lib/use-cv-editor";
import { fonts, tokens } from "../theme.stylex";
import { formatDate } from "./subscriptions";
import { Button, ErrorNote, InfoNote, QueryError } from "./ui";

const cvStyles = stylex.create({
  status: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: tokens.muted,
    lineHeight: "21px",
  },
  strong: { color: tokens.ink, fontWeight: 700 },
  area: {
    width: "100%",
    minHeight: 180,
    boxSizing: "border-box",
    marginTop: 12,
    padding: "10px 12px",
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: "20px",
    color: tokens.ink,
    backgroundColor: tokens.surfaceSunken,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: tokens.lineStrong,
    borderRadius: tokens.radiusSm,
  },
  count: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: tokens.muted,
    marginTop: 8,
  },
  countBad: { color: tokens.danger },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 12,
  },
  file: { fontFamily: fonts.sans, fontSize: 13, color: tokens.muted },
  buttons: { display: "flex", gap: 8, marginTop: 12 },
  errorGap: { marginTop: 12 },
});

const CvStatus = ({ cv }: { cv: CvDtoType }) => (
  <p {...stylex.props(cvStyles.status)}>
    {cv.hasCv ? (
      <>
        <span {...stylex.props(cvStyles.strong)}>
          {cv.filename ?? "Pasted CV"}
        </span>
        {` · ${cv.charCount} chars · updated ${cv.updatedAt ? formatDate(cv.updatedAt) : "—"}`}
      </>
    ) : (
      "No CV saved yet. Paste your CV or upload a file — your DM job cards will show an AI match score."
    )}
  </p>
);

/** Personal CV editor: paste text or upload .pdf/.txt/.md. Rendered on the DM page only. */
export const CvPanel = () => {
  const cv = useCv(true);
  const {
    save,
    remove,
    upload,
    draft,
    setDraft,
    fileError,
    errorMessage,
    reading,
    confirmingRemoval,
    setConfirmingRemoval,
    shown,
    count,
    valid,
    busy,
    onFile,
    onSave,
    onRemove,
  } = useCvEditor(cv.data);

  if (cv.isPending) {
    return <p {...stylex.props(cvStyles.status)}>Loading…</p>;
  }
  if (cv.isError) {
    return <QueryError error={cv.error} />;
  }

  let saveLabel = cv.data.hasCv ? "Save changes" : "Save CV";
  if (save.isPending) {
    saveLabel = "Saving…";
  }

  return (
    <div>
      <CvStatus cv={cv.data} />
      <textarea
        {...stylex.props(cvStyles.area)}
        aria-label="CV text"
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste your CV text here…"
        value={shown}
      />
      <p
        {...stylex.props(
          cvStyles.count,
          !valid && count > 0 && cvStyles.countBad
        )}
      >
        {`${count} chars — needs ${CV_MIN_CHARS}–${CV_MAX_CHARS}.`}
      </p>
      <div {...stylex.props(cvStyles.row)}>
        <input
          {...stylex.props(cvStyles.file)}
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          aria-label="Upload CV file"
          disabled={busy}
          key={cv.data.updatedAt ?? "none"}
          onChange={(e) => onFile(e.target.files?.[0])}
          type="file"
        />
        {reading ? (
          <span {...stylex.props(cvStyles.status)}>Reading…</span>
        ) : null}
        {upload.isPending ? (
          <span {...stylex.props(cvStyles.status)}>Uploading…</span>
        ) : null}
      </div>
      {fileError ? (
        <div {...stylex.props(cvStyles.errorGap)}>
          <ErrorNote>{fileError}</ErrorNote>
        </div>
      ) : null}
      {errorMessage === null ? null : (
        <div {...stylex.props(cvStyles.errorGap)}>
          <ErrorNote>{errorMessage}</ErrorNote>
        </div>
      )}
      <div {...stylex.props(cvStyles.buttons)}>
        <Button disabled={busy || draft === null || !valid} onClick={onSave}>
          {saveLabel}
        </Button>
        {cv.data.hasCv ? (
          <Button
            disabled={busy}
            onClick={() => setConfirmingRemoval(true)}
            variant="danger"
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        ) : null}
      </div>
      {confirmingRemoval ? (
        <div {...stylex.props(cvStyles.errorGap)}>
          <InfoNote>
            Remove your CV? DM job cards will no longer show match scores.
          </InfoNote>
          <div {...stylex.props(cvStyles.buttons)}>
            <Button disabled={busy} onClick={onRemove} variant="danger">
              {remove.isPending ? "Removing…" : "Confirm remove"}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setConfirmingRemoval(false)}
              variant="subtle"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
