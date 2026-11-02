import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Slot as SlotPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

// shadcn Button. Variants map to Kappa's component-layer recipes in
// styles.css (DESIGN.md: recipes live in @layer components via @apply).
export const buttonVariants = cva("app-button", {
  defaultVariants: { size: "default", variant: "default" },
  variants: {
    size: { default: "", icon: "icon", sm: "compact" },
    variant: {
      danger: "danger",
      dangerSubtle: "dangerSubtle",
      default: "",
      discord: "discord-login",
      ghost: "ghost",
      subtle: "subtle",
    },
  },
});

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & ButtonVariantProps & { asChild?: boolean }) => {
  const Comp = asChild ? SlotPrimitive.Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ size, variant }), className)}
      data-slot="button"
      {...props}
    />
  );
};
