import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export const Input = ({ className, ...props }: ComponentProps<"input">) => (
  <input className={cn("app-input", className)} data-slot="input" {...props} />
);
