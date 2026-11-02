import { ChevronDownIcon } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = ({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) => (
  <AccordionPrimitive.Item
    className={cn("app-accordion-item", className)}
    data-slot="accordion-item"
    {...props}
  />
);

export const AccordionTrigger = ({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) => (
  <AccordionPrimitive.Header className="app-accordion-header">
    <AccordionPrimitive.Trigger
      className={cn("app-accordion-trigger", className)}
      data-slot="accordion-trigger"
      {...props}
    >
      {children}
      <ChevronDownIcon aria-hidden="true" className="app-accordion-icon" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);

export const AccordionContent = ({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) => (
  <AccordionPrimitive.Content
    className={cn("app-accordion-content", className)}
    data-slot="accordion-content"
    {...props}
  >
    <div>{children}</div>
  </AccordionPrimitive.Content>
);
