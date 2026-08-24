import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  className?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-muted">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {subtitle ? (
              <p className="mt-1 text-xs text-muted">{subtitle}</p>
            ) : null}
            {trend ? (
              <p
                className={cn(
                  "mt-2 text-xs font-medium",
                  trend.positive ? "text-success" : "text-muted",
                )}
              >
                {trend.value}
              </p>
            ) : null}
          </div>
          {Icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
