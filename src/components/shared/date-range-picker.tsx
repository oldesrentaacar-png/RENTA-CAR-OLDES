"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type DateRangeValue = {
  from: string;
  to: string;
};

export type DateRangePickerProps = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
};

export function DateRangePicker({
  value,
  onChange,
  fromLabel = "Desde",
  toLabel = "Hasta",
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="date-from">{fromLabel}</Label>
        <Input
          id="date-from"
          type="date"
          value={value.from}
          onChange={(event) =>
            onChange({ ...value, from: event.target.value })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date-to">{toLabel}</Label>
        <Input
          id="date-to"
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
        />
      </div>
    </div>
  );
}
