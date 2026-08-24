"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
  currency?: string;
  error?: boolean;
};

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      value,
      onChange,
      currency = "USD",
      className,
      error,
      placeholder = "0.00",
      ...props
    },
    ref,
  ) => {
    const handleChange = (raw: string) => {
      const cleaned = raw.replace(/[^\d.,]/g, "").replace(",", ".");
      onChange(cleaned);
    };

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
          {currency}
        </span>
        <Input
          ref={ref}
          inputMode="decimal"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder={placeholder}
          error={error}
          className={cn("pl-12 text-right tabular-nums", className)}
          {...props}
        />
      </div>
    );
  },
);

MoneyInput.displayName = "MoneyInput";
