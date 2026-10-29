import { CV_MAX_CHARS, CV_MIN_CHARS } from "@kappa/contracts";
import { useId } from "react";

import { useCv } from "../lib/queries";
import type { CvDtoType } from "../lib/queries";
import { useCvEditor } from "../lib/use-cv-editor";
import { formatDate } from "./subscriptions";
import {
  Button,
  ErrorNote,
  HStack,
  InfoNote,
  LoadingNote,
  QueryError,
  Text,
  TextArea,
  VStack,
} from "./ui";

import styles from "./data-views.module.css";

const CvStatus = ({ cv }: { cv: CvDtoType }) => (
  <div className={styles.cvStatus}>
    {cv.hasCv ? (
      <>
        <Text as="p" color="primary" weight="bold">
          {cv.filename ?? "Pasted CV"}
        </Text>
        <div className={styles.meta}>
          <Text as="span" color="secondary" type="supporting">
            {cv.charCount} chars
          </Text>
          <Text as="span" color="secondary" type="supporting">
            Updated {cv.updatedAt ? formatDate(cv.updatedAt) : "—"}
          </Text>
        </div>
      </>
    ) : (
      <Text as="p" color="secondary">
        No CV saved yet. Paste your CV or upload a file — your DM job cards will
        show an AI match score.
      </Text>
    )}
  </div>
);

/** Keyed by the stored update time so the native file selection resets. */
const CvFileInput = ({
  busy,
  fileError,
  isLoading,
  onFile,
}: {
  busy: boolean;
  fileError: string | null;
  isLoading: boolean;
  onFile: (file: File | undefined) => Promise<void>;
}) => {
  const id = useId();

  return (
    <div className={styles.fileField}>
      <label className={styles.fileLabel} htmlFor={id}>
        Upload CV file
      </label>
      <input
        accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
        aria-busy={isLoading}
        aria-describedby={`${id}-description${fileError ? ` ${id}-error` : ""}`}
        aria-invalid={Boolean(fileError)}
        className={styles.fileInput}
        disabled={busy}
        id={id}
        onChange={(event) => {
          void onFile(event.currentTarget.files?.[0]);
        }}
        type="file"
      />
      <p className={styles.fileDescription} id={`${id}-description`}>
        Upload a .pdf, .txt, or .md file.
      </p>
      {fileError ? (
        <div id={`${id}-error`}>
          <ErrorNote>{fileError}</ErrorNote>
        </div>
      ) : null}
    </div>
  );
};

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
    return <LoadingNote />;
  }
  if (cv.isError) {
    return <QueryError error={cv.error} />;
  }

  let saveLabel = cv.data.hasCv ? "Save changes" : "Save CV";
  if (save.isPending) {
    saveLabel = "Saving…";
  }

  const textDescription = `${count} chars — needs ${CV_MIN_CHARS}–${CV_MAX_CHARS}.`;

  return (
    <VStack gap={3}>
      <CvStatus cv={cv.data} />
      {/* Keep the editor's trimmed UTF-16 count; do not truncate native textarea input. */}
      <TextArea
        description={textDescription}
        disabled={busy}
        error={valid ? undefined : textDescription}
        label="CV text"
        onChange={setDraft}
        placeholder="Paste your CV text here…"
        value={shown}
      />
      <VStack gap={2}>
        <CvFileInput
          busy={busy}
          fileError={fileError}
          isLoading={reading || upload.isPending}
          key={cv.data.updatedAt ?? "none"}
          onFile={onFile}
        />
        {reading ? (
          <Text color="secondary" type="supporting">
            Reading…
          </Text>
        ) : null}
        {upload.isPending ? (
          <Text color="secondary" type="supporting">
            Uploading…
          </Text>
        ) : null}
      </VStack>
      {errorMessage === null ? null : <ErrorNote>{errorMessage}</ErrorNote>}
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Button
          disabled={busy || draft === null || !valid}
          loading={save.isPending}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
        {cv.data.hasCv ? (
          <Button
            disabled={busy}
            loading={remove.isPending}
            onClick={() => setConfirmingRemoval(true)}
            variant="danger"
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        ) : null}
      </HStack>
      {confirmingRemoval ? (
        <VStack gap={3}>
          <InfoNote>
            Remove your CV? DM job cards will no longer show match scores.
          </InfoNote>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Button
              disabled={busy}
              loading={remove.isPending}
              onClick={onRemove}
              variant="danger"
            >
              {remove.isPending ? "Removing…" : "Confirm remove"}
            </Button>
            <Button
              disabled={busy}
              onClick={() => setConfirmingRemoval(false)}
              variant="subtle"
            >
              Cancel
            </Button>
          </HStack>
        </VStack>
      ) : null}
    </VStack>
  );
};
