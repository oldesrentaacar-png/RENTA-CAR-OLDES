import { cn } from "@/lib/utils";

export type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

const toneStyles = {
  default: "bg-border",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export type ActivityTimelineProps = {
  items: ActivityItem[];
  className?: string;
  emptyMessage?: string;
};

export function ActivityTimeline({
  items,
  className,
  emptyMessage = "Sin actividad reciente",
}: ActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <p className={cn("py-8 text-center text-sm text-muted", className)}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className={cn("relative space-y-0", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 ? (
            <span
              className="absolute left-[7px] top-4 h-full w-px bg-border"
              aria-hidden="true"
            />
          ) : null}
          <span
            className={cn(
              "relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-surface",
              toneStyles[item.tone ?? "default"],
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-medium text-foreground">{item.title}</p>
            {item.description ? (
              <p className="mt-0.5 text-sm text-muted">{item.description}</p>
            ) : null}
            <time className="mt-1 block text-xs text-muted">{item.timestamp}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
