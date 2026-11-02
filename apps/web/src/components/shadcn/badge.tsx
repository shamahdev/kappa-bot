import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export const badgeVariants = cva("app-badge", {
  defaultVariants: { variant: "default" },
  variants: { variant: { default: "", strong: "strong" } },
});

export const Badge = ({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) => (
  <span
    className={cn(badgeVariants({ variant }), className)}
    data-slot="badge"
    {...props}
  />
);
