"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-lg border bg-surface text-base text-foreground placeholder:text-foreground-subtle transition-colors duration-base focus:outline-none",
  {
    variants: {
      variant: {
        default: "border-border focus:border-border-strong",
        error: "border-red focus:border-red",
      },
      size: {
        sm: "h-10 px-3 text-sm",
        md: "h-12 px-4 text-base",
        lg: "h-14 px-5 text-lg",
      },
      state: {
        default: "",
        disabled: "cursor-not-allowed bg-hover-bg opacity-60",
      },
    },
    defaultVariants: { variant: "default", size: "md", state: "default" },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, state, disabled, ...props }, ref) => (
    <input
      ref={ref}
      disabled={disabled}
      aria-disabled={disabled ? true : undefined}
      className={cn(
        inputVariants({ variant, size, state: disabled ? "disabled" : state }),
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

const INPUT_HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "h-10",
  md: "h-12",
  lg: "h-14",
};

/** Input with optional leading / trailing icon slots. */
export function InputWithIcon({
  className,
  leadingIcon,
  trailingIcon,
  size = "md",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
}) {
  const cloned = React.cloneElement(children, {
    className: cn(
      children.props.className,
      leadingIcon && "pl-11",
      trailingIcon && "pr-11"
    ),
  });

  return (
    <div className={cn("relative flex items-center", className)} {...props}>
      {leadingIcon && (
        <span
          className={cn(
            "pointer-events-none absolute left-3 flex items-center justify-center text-foreground-subtle",
            INPUT_HEIGHT[size]
          )}
        >
          {leadingIcon}
        </span>
      )}
      {cloned}
      {trailingIcon && (
        <span
          className={cn(
            "absolute right-3 flex items-center justify-center text-foreground-subtle",
            INPUT_HEIGHT[size]
          )}
        >
          {trailingIcon}
        </span>
      )}
    </div>
  );
}

export { inputVariants };
