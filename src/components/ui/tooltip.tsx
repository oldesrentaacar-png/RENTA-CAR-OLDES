"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
};

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-white shadow-md",
            side === "top" ? "bottom-full left-1/2 mb-2 -translate-x-1/2" : "top-full left-1/2 mt-2 -translate-x-1/2",
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
