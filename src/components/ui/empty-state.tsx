import Link from "next/link";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center",
        className,
      )}
    >
      <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-zinc-600">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-6 inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
