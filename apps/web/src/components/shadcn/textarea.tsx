import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export const Textarea = ({
  className,
  ...props
}: ComponentProps<"textarea">) => (
  <textarea
    className={cn("app-input app-textarea", className)}
    data-slot="textarea"
    {...props}
  />
);
