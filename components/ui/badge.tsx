import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-foreground text-accent-fg",
        secondary: "bg-muted text-foreground-muted",
        outline: "border border-border text-foreground",
        success: "border border-green-border bg-green-soft text-green-fg",
        warning: "border border-orange-border bg-orange-soft text-orange-fg",
        danger: "border border-red-border bg-red-soft text-red-fg",
        info: "border border-blue-border bg-blue-soft text-blue-fg",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, dot = false, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
);
Badge.displayName = "Badge";

export const Chip = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full border border-border bg-hover-bg px-3 py-1 text-sm text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </span>
));
Chip.displayName = "Chip";

export { badgeVariants };
