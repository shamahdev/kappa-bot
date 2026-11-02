import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export const ToggleGroup = ({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) => (
  <ToggleGroupPrimitive.Root
    className={cn("app-toggle-group", className)}
    data-slot="toggle-group"
    {...props}
  />
);

export const ToggleGroupItem = ({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) => (
  <ToggleGroupPrimitive.Item
    className={cn("app-toggle", className)}
    data-slot="toggle-group-item"
    {...props}
  />
);
