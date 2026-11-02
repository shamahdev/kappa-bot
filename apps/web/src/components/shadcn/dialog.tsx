import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogDescription = DialogPrimitive.Description;

export const DialogContent = ({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close dialog",
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  closeLabel?: string;
}) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="app-dialog-overlay" />
    <DialogPrimitive.Content
      className={cn("app-dialog", className)}
      data-slot="dialog-content"
      {...props}
    >
      {children}
      {showCloseButton ? (
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="app-button subtle icon app-dialog-close"
        >
          <XIcon aria-hidden="true" />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
);

export const DialogTitle = ({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title
    className={cn("app-dialog-title", className)}
    data-slot="dialog-title"
    {...props}
  />
);
