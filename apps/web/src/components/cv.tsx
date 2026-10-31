import { useId } from "react";

import { useCv } from "../lib/queries";
import { useCvEditor } from "../lib/use-cv-editor";
import {
  Button,
  ErrorNote,
  HStack,
  InfoNote,
  LoadingNote,
  QueryError,
  Text,
  VStack,
} from "./ui";

import styles from "./data-views.module.css";

/** Metadata-only personal CV controls. No text preview, editor or download. */
export const CvPanel = () => {
  const cv = useCv(true);
  const editor = useCvEditor();
  const id = useId();
  if (cv.isPending) {
    return <LoadingNote>Loading CV…</LoadingNote>;
  }
  if (cv.isError) {
    return <QueryError error={cv.error} />;
  }
  const uploadedAt = cv.data.updatedAt;
  let removeLabel = "Remove CV";
  if (editor.confirmingRemoval) {
    removeLabel = "Confirm remove";
  }
  if (editor.remove.isPending) {
    removeLabel = "Removing…";
  }
  return (
    <VStack gap={4}>
      <div className={styles.cvStatus}>
        {cv.data.hasCv ? (
          <>
            <Text as="p" weight="semibold">
              {cv.data.filename ?? "Uploaded CV"}
            </Text>
            {uploadedAt ? (
              <Text as="p" color="secondary" type="supporting">
                Uploaded{" "}
                <time dateTime={uploadedAt}>
                  {new Date(uploadedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </Text>
            ) : null}
          </>
        ) : (
          <Text as="p" color="secondary">
            No CV uploaded yet.
          </Text>
        )}
      </div>
      <Text as="p" color="secondary" type="supporting">
        Your full CV is used privately for personal job match grades. Extracted
        text is never displayed.
      </Text>
      {editor.confirmingRemoval ? (
        <InfoNote>
          Remove your CV? Future personal job assessments will no longer use it.
        </InfoNote>
      ) : (
        <div className={styles.fileField}>
          <label className={styles.fileLabel} htmlFor={id}>
            {cv.data.hasCv ? "Replace CV" : "Upload CV"}
          </label>
          <input
            id={id}
            className={styles.fileInput}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            aria-describedby={`${id}-description${editor.errorMessage ? ` ${id}-error` : ""}`}
            aria-invalid={Boolean(editor.errorMessage) || undefined}
            aria-busy={editor.upload.isPending || undefined}
            disabled={editor.busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              editor.onFile(file);
            }}
          />
          <p id={`${id}-description`} className={styles.fileDescription}>
            PDF up to 2MB; TXT or MD up to 500KB. Uploading replaces your saved
            CV.
          </p>
        </div>
      )}
      {editor.upload.isPending ? (
        <LoadingNote>Uploading and processing CV…</LoadingNote>
      ) : null}
      {editor.upload.isSuccess && !editor.confirmingRemoval ? (
        <output className="app-muted">CV uploaded.</output>
      ) : null}
      {editor.errorMessage ? (
        <div id={`${id}-error`}>
          <ErrorNote>{editor.errorMessage}</ErrorNote>
        </div>
      ) : null}
      {cv.data.hasCv ? (
        <HStack gap={2} wrap="wrap">
          <Button
            disabled={editor.busy}
            loading={editor.remove.isPending}
            variant="danger"
            onClick={
              editor.confirmingRemoval ? editor.onRemove : editor.confirmRemoval
            }
          >
            {removeLabel}
          </Button>
          {editor.confirmingRemoval ? (
            <Button
              disabled={editor.busy}
              variant="subtle"
              onClick={() => editor.setConfirmingRemoval(false)}
            >
              Cancel
            </Button>
          ) : null}
        </HStack>
      ) : null}
    </VStack>
  );
};
