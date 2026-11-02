import { Toaster as Sonner } from "sonner";
import type { ToasterProps } from "sonner";

// shadcn Toaster skinned with Kappa recipes; uses sonner's default duration.
export const Toaster = (props: ToasterProps) => (
  <Sonner
    className="app-toaster"
    position="bottom-center"
    toastOptions={{
      classNames: {
        actionButton: "app-toast-action",
        description: "app-toast-description",
        title: "app-toast-title",
        toast: "app-toast",
      },
      unstyled: true,
    }}
    {...props}
  />
);
