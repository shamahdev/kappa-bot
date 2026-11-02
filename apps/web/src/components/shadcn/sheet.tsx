import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

// shadcn Sheet: a Dialog anchored to a screen edge (mobile navigation).
export const Sheet = SheetPrimitive.Root;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

export const SheetContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content>) => (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="app-dialog-overlay" />
    <SheetPrimitive.Content
      className={cn("app-sheet", className)}
      data-slot="sheet-content"
      {...props}
    >
      {children}
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
);
