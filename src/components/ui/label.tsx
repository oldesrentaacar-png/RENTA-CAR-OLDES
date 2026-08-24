"use client";

import { forwardRef, type LabelHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span className="ml-0.5 text-accent" aria-hidden="true">
          *
        </span>
      ) : null}
    </label>
  ),
);

Label.displayName = "Label";
