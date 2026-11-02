import { CheckIcon } from "lucide-react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export const DropdownMenuContent = ({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content
      className={cn("app-popover app-menu", className)}
      data-slot="dropdown-menu-content"
      sideOffset={sideOffset}
      {...props}
    />
  </MenuPrimitive.Portal>
);

export const DropdownMenuLabel = ({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Label>) => (
  <MenuPrimitive.Label
    className={cn("app-menu-label", className)}
    data-slot="dropdown-menu-label"
    {...props}
  />
);

export const DropdownMenuItem = ({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item>) => (
  <MenuPrimitive.Item
    className={cn("app-menu-item", className)}
    data-slot="dropdown-menu-item"
    {...props}
  />
);

export const DropdownMenuRadioItem = ({
  className,
  children,
  ...props
}: ComponentProps<typeof MenuPrimitive.RadioItem>) => (
  <MenuPrimitive.RadioItem
    className={cn("app-menu-item", className)}
    data-slot="dropdown-menu-radio-item"
    {...props}
  >
    {children}
    <MenuPrimitive.ItemIndicator className="app-menu-indicator">
      <CheckIcon aria-hidden="true" />
    </MenuPrimitive.ItemIndicator>
  </MenuPrimitive.RadioItem>
);

export const DropdownMenuSeparator = ({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) => (
  <MenuPrimitive.Separator
    className={cn("app-menu-separator", className)}
    {...props}
  />
);
